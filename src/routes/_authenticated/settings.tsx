import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { auth } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings as SettingsIcon, Users, UserPlus, Trash2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentTeam, fetchTeammates, fetchPendingInvites, initials } from "@/lib/team";
import { InviteTeammateDialog } from "@/components/invite-teammate-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setEmail(data.user.email ?? "");
      setUserId(data.user.id);
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      setName(p?.display_name ?? "");
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    
    // Update Firebase user profile
    if (auth.currentUser && name.trim()) {
      await updateProfile(auth.currentUser, { displayName: name.trim() }).catch(() => {});
    }

    const { error } = await supabase.from("profiles").upsert({ id: data.user.id, display_name: name });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-8">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-brand" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Profile</h2>
        <Card className="p-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </Card>
      </section>

      <TeamSection currentUserId={userId} />
    </div>
  );
}

function TeamSection({ currentUserId }: { currentUserId: string | null }) {
  const qc = useQueryClient();
  const { data: team } = useCurrentTeam();
  const [teamName, setTeamName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => { if (team) setTeamName(team.name); }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: roster } = useQuery({
    queryKey: ["teammates", team?.id],
    queryFn: () => (team ? fetchTeammates(team.id) : Promise.resolve([])),
    enabled: !!team,
  });
  const { data: invites } = useQuery({
    queryKey: ["team-invites", team?.id],
    queryFn: () => (team ? fetchPendingInvites(team.id) : Promise.resolve([])),
    enabled: !!team,
  });

  const renameTeam = useMutation({
    mutationFn: async () => {
      if (!team) return;
      const { error } = await supabase.from("teams").update({ name: teamName }).eq("id", team.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Team renamed"); qc.invalidateQueries({ queryKey: ["current-team"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!team) return;
      const { error } = await supabase.from("team_members").delete().eq("team_id", team.id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["teammates", team?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_invites").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invite revoked"); qc.invalidateQueries({ queryKey: ["team-invites", team?.id] }); },
  });

  if (!team) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Team</h2>
        <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading team…
        </Card>
      </section>
    );
  }

  const isOwner = team.role === "owner";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Users className="w-4 h-4" /> Team
        </h2>
        {isOwner && (
          <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" /> Invite
          </Button>
        )}
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="team-name">Team name</Label>
            <Input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} disabled={!isOwner} />
          </div>
          {isOwner && (
            <Button onClick={() => renameTeam.mutate()} disabled={renameTeam.isPending || teamName === team.name}>
              Save
            </Button>
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground mb-2">
            MEMBERS ({roster?.length ?? 0})
          </div>
          <div className="divide-y border rounded-lg">
            {(roster ?? []).map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                <Avatar className="w-8 h-8">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                  <AvatarFallback className="text-xs">{initials(m.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.display_name ?? "Member"}
                    {m.user_id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                </div>
                {isOwner && m.role !== "owner" && (
                  <Button
                    size="icon" variant="ghost" className="w-8 h-8"
                    onClick={() => { if (confirm(`Remove ${m.display_name}?`)) removeMember.mutate(m.user_id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {isOwner && invites && invites.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground mb-2">
              PENDING INVITES ({invites.length})
            </div>
            <div className="divide-y border rounded-lg">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{i.email}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1"
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${i.token}`); toast.success("Link copied"); }}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => revokeInvite.mutate(i.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <InviteTeammateDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        teamId={team.id}
        teamName={team.name}
        invites={invites ?? []}
      />
    </section>
  );
}
