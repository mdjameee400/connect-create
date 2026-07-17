import { useState } from "react";
import { Users, Copy, Video, Plus, UserPlus, Loader2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "@tanstack/react-router";
import { useCurrentTeam, fetchTeammates, fetchPendingInvites, isOnline, initials, makeSlug } from "@/lib/team";
import { InviteTeammateDialog } from "@/components/invite-teammate-dialog";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";

export function MeetPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: team } = useCurrentTeam();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { data: roster } = useQuery({
    queryKey: ["teammates", team?.id],
    queryFn: () => (team ? fetchTeammates(team.id) : Promise.resolve([])),
    enabled: !!team,
    refetchInterval: 60_000,
  });
  const { data: invites } = useQuery({
    queryKey: ["team-invites", team?.id],
    queryFn: () => (team ? fetchPendingInvites(team.id) : Promise.resolve([])),
    enabled: !!team,
  });

  const { data: today } = useQuery({
    queryKey: ["meetings", "today", team?.id],
    queryFn: async () => {
      if (!team) return [];
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, starts_at, duration_minutes, room_slug, created_by")
        .eq("team_id", team.id)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!team,
    refetchInterval: 60_000,
  });

  const instantMeet = useMutation({
    mutationFn: async () => {
      if (!team) throw new Error("No team");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      for (let attempt = 0; attempt < 5; attempt++) {
        const slug = makeSlug();
        const { data, error } = await supabase
          .from("meetings")
          .insert({
            team_id: team.id,
            created_by: userData.user.id,
            title: "Instant meeting",
            starts_at: new Date().toISOString(),
            duration_minutes: 30,
            room_slug: slug,
          })
          .select("room_slug")
          .single();
        if (!error && data) return data;
        if (error && !error.message.includes("room_slug")) throw error;
      }
      throw new Error("Could not create meeting");
    },
    onSuccess: async (m) => {
      const url = `${window.location.origin}/m/${m.room_slug}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Join link copied", { description: url });
      } catch {
        toast.success("Meeting created");
      }
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigate({ to: "/m/$slug", params: { slug: m.room_slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyMeetingLink = (slug: string) => {
    const url = `${window.location.origin}/m/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-brand" />
        <h2 className="text-2xl font-semibold">Meet</h2>
      </div>

      <Card
        className="p-5 border-0"
        style={{ background: "linear-gradient(135deg, oklch(0.72 0.16 255), oklch(0.62 0.19 255))" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="text-white">
            <div className="font-semibold text-[15px]">Instant Meeting</div>
            <div className="text-white/85 text-sm">Start a room and invite your team instantly.</div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-slate-900 hover:bg-white/90 gap-1.5"
            onClick={() => instantMeet.mutate()}
            disabled={instantMeet.isPending || !team}
          >
            {instantMeet.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            Start & copy link
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">SCHEDULED TODAY</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{today?.length ?? 0} Meetings</span>
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setScheduleOpen(true)} disabled={!team}>
              <Plus className="w-3.5 h-3.5" /> New
            </Button>
          </div>
        </div>
        <div className="divide-y">
          {(!today || today.length === 0) ? (
            <div className="px-5 py-6 text-sm text-muted-foreground text-center">
              Nothing scheduled today.{" "}
              <button className="text-brand font-medium hover:underline" onClick={() => setScheduleOpen(true)}>
                Schedule one
              </button>
            </div>
          ) : (
            today.map((m) => {
              const dt = new Date(m.starts_at);
              const past = dt.getTime() + m.duration_minutes * 60_000 < Date.now();
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-11 text-center">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {dt.toLocaleString(undefined, { month: "short" })}
                    </div>
                    <div className="text-lg font-semibold leading-tight">{dt.getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {m.duration_minutes}m
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => copyMeetingLink(m.room_slug)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant={past ? "ghost" : "outline"} asChild>
                    <Link to="/m/$slug" params={{ slug: m.room_slug }}>{past ? "Open" : "Join"}</Link>
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">TEAMMATES</div>
          {team?.role === "owner" && (
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Invite
            </Button>
          )}
        </div>
        <div className="divide-y">
          {(!roster || roster.length === 0) ? (
            <div className="px-5 py-6 text-sm text-muted-foreground text-center">Just you so far.</div>
          ) : (
            roster.map((t) => {
              const online = isOnline(t.last_seen_at);
              return (
                <div key={t.user_id} className="flex items-center gap-3 px-5 py-3">
                  <div className="relative">
                    <Avatar className="w-9 h-9">
                      {t.avatar_url && <AvatarImage src={t.avatar_url} />}
                      <AvatarFallback className="bg-secondary text-xs">{initials(t.display_name)}</AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                        online ? "bg-brand" : "bg-muted-foreground/40"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {t.display_name ?? "Teammate"}
                      {t.role === "owner" && <span className="ml-1.5 text-[10px] text-muted-foreground">OWNER</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className={online ? "text-brand" : ""}>{online ? "Online" : "Offline"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {invites && invites.length > 0 && (
            <div className="px-5 py-2 bg-secondary/40 text-[11px] text-muted-foreground">
              {invites.length} pending invite{invites.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </Card>

      {team && (
        <>
          <InviteTeammateDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            teamId={team.id}
            teamName={team.name}
            invites={invites ?? []}
          />
          <ScheduleMeetingDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            teamId={team.id}
          />
        </>
      )}
    </div>
  );
}
