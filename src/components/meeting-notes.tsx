import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Collaborative notepad — one shared note per meeting. Local edits are saved
 * (debounced) and broadcast so everyone sees the text as it is typed.
 */
export function MeetingNotes({
  meetingId,
  bodyOut,
}: {
  meetingId: string;
  bodyOut?: { current: string };
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meRef = useRef<string>(crypto.randomUUID());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (bodyOut) bodyOut.current = body;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u.user?.id) meRef.current = u.user.id;
        const { data } = await supabase
          .from("meeting_notes")
          .select("body")
          .eq("meeting_id", meetingId)
          .maybeSingle();
        if (!active) return;
        setBody(data?.body ?? "");
      } catch (err) {
        console.warn("[Notes] Remote notes query skipped:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`notes:${meetingId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "notes" }, ({ payload }) => {
        const { body: next, from } = payload as { body: string; from: string };
        if (from !== meRef.current) setBody(next);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const persist = useCallback(
    (next: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = setTimeout(async () => {
        try {
          await supabase
            .from("meeting_notes")
            .upsert(
              { meeting_id: meetingId, body: next, updated_by: meRef.current, updated_at: new Date().toISOString() },
              { onConflict: "meeting_id" },
            );
        } catch {
          // ignore
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [meetingId],
  );

  const onChange = (next: string) => {
    setBody(next);
    channelRef.current?.send({
      type: "broadcast",
      event: "notes",
      payload: { body: next, from: meRef.current },
    });
    persist(next);
  };

  if (loading)
    return (
      <div className="grid place-items-center h-full text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );

  return (
    <div className="flex flex-col h-full min-h-0">
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Shared notes — everyone in this meeting can edit."
        aria-label="Shared meeting notes"
        className="flex-1 min-h-0 w-full resize-none bg-transparent p-3 text-sm outline-none"
      />
      <div className="px-3 py-1.5 border-t text-[11px] text-muted-foreground">
        {saving ? "Saving…" : "Saved"}
      </div>
    </div>
  );
}
