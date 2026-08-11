import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
};

const TYPING_TTL = 3000;

/**
 * Meeting chat state. Lives in the meeting room (not the panel) so messages
 * keep arriving — and the unread badge keeps counting — while the panel is
 * closed. Messages are delivered instantly over a realtime broadcast and
 * persisted to the database in parallel for history.
 */
export function useMeetingChat(meetingId: string, displayName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSent = useRef(0);
  const nameRef = useRef(displayName);
  nameRef.current = displayName;

  const merge = useCallback((row: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === row.id)) {
        return prev.map((m) => (m.id === row.id ? { ...row } : m));
      }
      return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

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
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...(data ?? []).filter((d) => !seen.has(d.id)), ...prev].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
      });
      setLoading(false);
    })();

    const channel = supabase
      .channel(`chat:${meetingId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "chat" }, ({ payload }) => merge(payload as ChatMessage))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { name } = payload as { name: string };
        if (!name) return;
        setTyping((prev) => (prev.includes(name) ? prev : [...prev, name]));
        clearTimeout(typingTimers.current[name]);
        typingTimers.current[name] = setTimeout(() => {
          setTyping((prev) => prev.filter((n) => n !== name));
        }, TYPING_TTL);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meeting_messages",
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => merge(payload.new as ChatMessage),
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      active = false;
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
      supabase.removeChannel(channel);
    };
  }, [meetingId, merge]);

  const send = useCallback(
    async (raw: string) => {
      const body = raw.trim();
      if (!body || !me) return;
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        sender_id: me,
        sender_name: nameRef.current,
        body,
        created_at: new Date().toISOString(),
        pending: true,
      };
      merge(msg);
      channelRef.current?.send({
        type: "broadcast",
        event: "chat",
        payload: { ...msg, pending: false },
      });
      const { error } = await supabase.from("meeting_messages").insert({
        id: msg.id,
        meeting_id: meetingId,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        body: msg.body,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, pending: false, failed: Boolean(error) } : m,
        ),
      );
    },
    [me, meetingId, merge],
  );

  const retry = useCallback(
    async (id: string) => {
      const msg = messages.find((m) => m.id === id);
      if (!msg) return;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      await send(msg.body);
    },
    [messages, send],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1200) return;
    lastTypingSent.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { name: nameRef.current },
    });
  }, []);

  /** Local-only system notice (join / leave). */
  const addNotice = useCallback(
    (text: string) => {
      merge({
        id: crypto.randomUUID(),
        sender_id: "system",
        sender_name: "system",
        body: text,
        created_at: new Date().toISOString(),
      });
    },
    [merge],
  );

  return { messages, loading, me, typing, send, retry, notifyTyping, addNotice };
}
