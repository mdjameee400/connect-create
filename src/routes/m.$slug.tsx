import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Copy, Calendar, Clock, Users, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { MeetingRoom } from "@/components/meeting-room";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/m/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Private meeting — Orbital Connect" },
      { name: "description", content: "Private workspace meetings on Orbital Connect." },
      { property: "og:title", content: "Private meeting — Orbital Connect" },
      { property: "og:description", content: "This meeting is only open to workspace members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingPage,
});

type Meeting = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  notes: string | null;
  host_name: string | null;
};

type Access = "loading" | "signed-out" | "no-access" | "ok";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b flex items-center px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-semibold tracking-tight">Orbital Connect</span>
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-10">{children}</main>
    </div>
  );
}

function MeetingPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [access, setAccess] = useState<Access>("loading");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setAccess("signed-out");
        return;
      }

      // RLS: only members of the meeting's workspace can read this row.
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, starts_at, duration_minutes, notes, created_by")
        .eq("room_slug", slug)
        .maybeSingle();

      if (error || !data) {
        setAccess("no-access");
        return;
      }

      const { data: me } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const name =
        me?.display_name || (user.email ? user.email.split("@")[0] : "") || "Teammate";
      setDisplayName(name);

      let host: string | null = null;
      if (data.created_by) {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.created_by)
          .maybeSingle();
        host = p?.display_name ?? null;
      }

      setMeeting({
        id: data.id,
        title: data.title,
        starts_at: data.starts_at,
        duration_minutes: data.duration_minutes,
        notes: data.notes,
        host_name: host,
      });
      setAccess("ok");
    })();
  }, [slug]);

  const copy = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Meeting link copied");
  };

  if (access === "loading") {
    return (
      <Shell>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </Shell>
    );
  }

  if (access === "signed-out") {
    return (
      <Shell>
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary grid place-items-center mx-auto mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">This meeting is private</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Meeting links only work for signed-in members of the host's workspace.
            Sign in to continue.
          </p>
          <Button
            className="w-full mt-6"
            onClick={() =>
              navigate({
                to: "/auth",
                search: { redirect: `/m/${slug}` },
                replace: true,
              })
            }
          >
            Sign in to join
          </Button>
        </Card>
      </Shell>
    );
  }

  if (access === "no-access" || !meeting) {
    return (
      <Shell>
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary grid place-items-center mx-auto mb-4">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">You don't have access</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This meeting belongs to a workspace you're not part of. Ask the host to invite
            you to their workspace, then open this link again.
          </p>
          <Button variant="outline" className="w-full mt-6" asChild>
            <Link to="/dashboard">Go to your dashboard</Link>
          </Button>
        </Card>
      </Shell>
    );
  }

  const dt = new Date(meeting.starts_at);
  const endMs = dt.getTime() + meeting.duration_minutes * 60_000;
  const status: "upcoming" | "live" | "ended" =
    Date.now() < dt.getTime() ? "upcoming" : Date.now() < endMs ? "live" : "ended";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b flex items-center px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-semibold tracking-tight">Orbital Connect</span>
        </Link>
        <div className="ml-auto">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={copy}>
            <Copy className="w-3.5 h-3.5" /> Copy link
          </Button>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-8">
        {inRoom ? (
          <MeetingRoom slug={slug} displayName={displayName} onLeave={() => setInRoom(false)} />
        ) : (
          <Card className="w-full max-w-lg p-8">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase mb-3">
              {status === "live" ? (
                <span className="inline-flex items-center gap-1.5 text-live">
                  <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" /> Live now
                </span>
              ) : (
                <span className="text-muted-foreground">{status === "upcoming" ? "Upcoming" : "Ended"}</span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground font-medium normal-case tracking-normal">
                <Lock className="w-3 h-3" /> Workspace only
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
            {meeting.host_name && (
              <p className="text-sm text-muted-foreground mt-1">Hosted by {meeting.host_name}</p>
            )}
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {dt.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {meeting.duration_minutes}m
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Joining as {displayName}
              </div>
            </div>

            {meeting.notes && (
              <div className="mt-4 p-3 bg-secondary rounded-lg text-sm whitespace-pre-wrap">
                {meeting.notes}
              </div>
            )}

            <Button
              size="lg"
              className="w-full mt-6 gap-2"
              onClick={() => setInRoom(true)}
              disabled={status === "ended"}
            >
              <Video className="w-4 h-4" />
              {status === "ended" ? "Meeting ended" : "Join room"}
            </Button>

            <Button variant="ghost" className="w-full mt-2 gap-1.5" onClick={copy}>
              <Copy className="w-3.5 h-3.5" /> Copy join link
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
