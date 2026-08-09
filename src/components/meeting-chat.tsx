import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export function MeetingChat({
  meetingId,
  displayName,
  onNewMessage,
}: {
  meetingId: string;
  displayName: string;
  onNewMessage?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef(onNewMessage);
  notifyRef.current = onNewMessage;

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (active) setMe(u.user?.id ?? null);
      const { data } = await supabase
        .from("meeting_messages")
        .select("id, sender_id, sender_name, body, created_at")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!active) return;
      setMessages(data ?? []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`chat:${meetingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "meeting_messages", filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          notifyRef.current?.();
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !me || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("meeting_messages").insert({
      meeting_id: meetingId,
      sender_id: me,
      sender_name: displayName,
      body,
    });
    if (error) setText(body);
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b text-sm font-semibold tracking-tight">Chat</div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No messages yet. Say hello to the room.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2">
              <div className="w-7 h-7 shrink-0 rounded-full bg-secondary grid place-items-center text-[11px] font-semibold">
                {m.sender_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">
                  {m.sender_id === me ? "You" : m.sender_name} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="text-sm break-words whitespace-pre-wrap">{m.body}</div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message the room"
          aria-label="Message"
        />
        <Button size="icon" onClick={() => void send()} disabled={!text.trim() || sending} aria-label="Send message">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
