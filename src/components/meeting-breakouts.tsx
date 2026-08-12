import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DoorOpen, Plus, LogOut } from "lucide-react";

export type Breakout = { id: string; name: string; closed: boolean; created_by: string };

/**
 * Breakout rooms. Joining one swaps the meeting's signalling channel to a
 * sub-room, so the peer mesh is rebuilt among that room's participants only.
 */
export function MeetingBreakouts({
  meetingId,
  activeId,
  onJoin,
}: {
  meetingId: string;
  activeId: string | null;
  onJoin: (breakout: Breakout | null) => void;
}) {
  const [rooms, setRooms] = useState<Breakout[]>([]);
  const [name, setName] = useState("");
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("meeting_breakouts")
      .select("id, name, closed, created_by")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });
    setRooms((data ?? []) as Breakout[]);
  }, [meetingId]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    void load();
    const channel = supabase
      .channel(`breakouts:${meetingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_breakouts", filter: `meeting_id=eq.${meetingId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, load]);

  const create = async () => {
    if (!name.trim() || !me) return;
    const { error } = await supabase
      .from("meeting_breakouts")
      .insert({ meeting_id: meetingId, name: name.trim(), created_by: me });
    if (error) return toast.error(error.message);
    setName("");
    void load();
  };

  const close = async (room: Breakout) => {
    const { error } = await supabase.from("meeting_breakouts").delete().eq("id", room.id);
    if (error) return toast.error(error.message);
    if (activeId === room.id) onJoin(null);
    void load();
  };

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
          }}
          placeholder="Room name"
          aria-label="Breakout room name"
        />
        <Button size="icon" aria-label="Create breakout room" onClick={() => void create()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {activeId && (
        <Button size="sm" variant="secondary" className="w-full gap-1.5" onClick={() => onJoin(null)}>
          <LogOut className="w-3.5 h-3.5" /> Return to main room
        </Button>
      )}

      {rooms.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No breakout rooms yet. Create one to split the meeting.
        </p>
      )}

      <ul className="space-y-2">
        {rooms.map((room) => (
          <li key={room.id} className="flex items-center gap-2 border rounded-lg px-2 py-1.5">
            <DoorOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="text-sm truncate flex-1">{room.name}</span>
            {activeId === room.id ? (
              <span className="text-[11px] text-muted-foreground">You're here</span>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => onJoin(room)}>
                Join
              </Button>
            )}
            {room.created_by === me && (
              <Button size="sm" variant="ghost" onClick={() => void close(room)}>
                Close
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
