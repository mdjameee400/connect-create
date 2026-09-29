import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Plus, Copy, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTeam } from "@/lib/team";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type Meeting = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  room_slug: string;
  notes: string | null;
};

function CalendarPage() {
  const qc = useQueryClient();
  const { data: team } = useCurrentTeam();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [monthAnchor, setMonthAnchor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const rangeStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1);
  const rangeEnd = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 2, 1);

  const { data: meetings } = useQuery({
    queryKey: ["meetings", "range", team?.id, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async (): Promise<Meeting[]> => {
      if (!team) return [];
      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("id, title, starts_at, duration_minutes, room_slug, notes")
          .eq("team_id", team.id)
          .gte("starts_at", rangeStart.toISOString())
          .lt("starts_at", rangeEnd.toISOString())
          .order("starts_at", { ascending: true });
        if (error) {
          console.warn("[Calendar] Meetings query warning:", error.message);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn("[Calendar] Meetings query error:", err);
        return [];
      }
    },
    enabled: !!team,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting deleted");
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  const dayMap = new Map<string, Meeting[]>();
  (meetings ?? []).forEach((m) => {
    const key = dayKey(new Date(m.starts_at));
    const arr = dayMap.get(key) ?? [];
    arr.push(m);
    dayMap.set(key, arr);
  });
  const selectedMeetings = dayMap.get(dayKey(selected)) ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-brand" />
          <h1 className="text-2xl font-semibold">Calendar</h1>
        </div>
        <Button className="gap-1.5" onClick={() => setScheduleOpen(true)} disabled={!team}>
          <Plus className="w-4 h-4" /> New meeting
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">
              {monthAnchor.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost"
                onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>
                ←
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); }}>
                Today
              </Button>
              <Button size="sm" variant="ghost"
                onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>
                →
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase text-muted-foreground mb-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {buildMonthGrid(monthAnchor).map((d, i) => {
              const isCurMonth = d.getMonth() === monthAnchor.getMonth();
              const isToday = dayKey(d) === dayKey(today);
              const isSelected = dayKey(d) === dayKey(selected);
              const count = dayMap.get(dayKey(d))?.length ?? 0;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(d)}
                  className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center relative transition-colors ${
                    isSelected ? "bg-brand text-brand-foreground"
                    : isToday ? "bg-brand-soft text-brand"
                    : isCurMonth ? "hover:bg-secondary" : "text-muted-foreground/40 hover:bg-secondary/50"
                  }`}
                >
                  <span>{d.getDate()}</span>
                  {count > 0 && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-brand"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">
            {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
          </div>
          <div className="mt-4 space-y-3">
            {!meetings ? (
              <div className="py-8 grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : selectedMeetings.length === 0 ? (
              <div className="py-8 text-sm text-muted-foreground text-center">
                No meetings this day.{" "}
                <button className="text-brand font-medium hover:underline" onClick={() => setScheduleOpen(true)}>
                  Schedule one
                </button>
              </div>
            ) : (
              selectedMeetings.map((m) => {
                const dt = new Date(m.starts_at);
                return (
                  <div key={m.id} className="p-3 rounded-lg border">
                    <div className="text-xs text-muted-foreground">
                      {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {m.duration_minutes}m
                    </div>
                    <div className="font-medium text-sm mt-0.5">{m.title}</div>
                    {m.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.notes}</div>}
                    <div className="mt-2 flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="gap-1 h-7"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/m/${m.room_slug}`); toast.success("Link copied"); }}>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 h-7" asChild>
                        <Link to="/m/$slug" params={{ slug: m.room_slug }}>
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </Link>
                      </Button>
                      <Button size="icon" variant="ghost" className="ml-auto w-7 h-7"
                        onClick={() => { if (confirm("Delete this meeting?")) del.mutate(m.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {team && (
        <ScheduleMeetingDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          teamId={team.id}
          defaultDate={selected}
        />
      )}
    </div>
  );
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push(d);
  }
  return grid;
}
