import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Team invite — Connect Orbital" },
      { name: "description", content: "You've been invited to join a team on Connect Orbital." },
    ],
  }),
  component: InvitePage,
});

type InviteRow = {
  id: string;
  team_id: string;
  email: string;
  status: string;
  team_name: string | null;
};

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteRow | null | undefined>(undefined);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      setSignedIn(!!userData.user);

      const { data, error } = await supabase
        .from("team_invites")
        .select("id, team_id, email, status, teams!inner(name)")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) { setInvite(null); return; }
      const t = data.teams as unknown as { name: string };
      setInvite({
        id: data.id,
        team_id: data.team_id,
        email: data.email,
        status: data.status,
        team_name: t?.name ?? "the team",
      });
    })();
  }, [token]);

  const accept = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in first");
      const { error: memberErr } = await supabase.from("team_members").insert({
        team_id: invite.team_id,
        user_id: userData.user.id,
        role: "member",
      });
      if (memberErr && !memberErr.message.includes("duplicate")) throw memberErr;
      await supabase
        .from("team_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", invite.id);
      toast.success(`Joined ${invite.team_name}`);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't accept invite");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-brand text-brand-foreground grid place-items-center">
            <Video className="w-5 h-5" />
          </div>
          <span className="font-semibold text-xl">Connect Orbital</span>
        </Link>

        <Card className="p-8 text-center">
          {invite === undefined ? (
            <div className="py-6"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>
          ) : invite === null ? (
            <>
              <XCircle className="w-10 h-10 mx-auto text-muted-foreground/70 mb-3" />
              <h1 className="text-xl font-semibold">Invite not found</h1>
              <p className="text-sm text-muted-foreground mt-1">This link may have been revoked or is no longer valid.</p>
            </>
          ) : invite.status !== "pending" ? (
            <>
              <XCircle className="w-10 h-10 mx-auto text-muted-foreground/70 mb-3" />
              <h1 className="text-xl font-semibold">Invite {invite.status}</h1>
              <p className="text-sm text-muted-foreground mt-1">This invite is no longer active.</p>
              <Button className="mt-6" asChild><Link to="/dashboard">Open dashboard</Link></Button>
            </>
          ) : signedIn ? (
            <>
              <CheckCircle2 className="w-10 h-10 mx-auto text-brand mb-3" />
              <h1 className="text-xl font-semibold">Join {invite.team_name}?</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Invited to {invite.email}. You'll see the team's recordings and meetings.
              </p>
              <Button className="mt-6 w-full" size="lg" onClick={accept} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Join team
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">You've been invited</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to join <span className="font-medium text-foreground">{invite.team_name}</span>.
              </p>
              <Button className="mt-6 w-full" size="lg" onClick={() => navigate({ to: "/auth" })}>
                Sign in to continue
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
