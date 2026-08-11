import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/hooks/use-meeting-chat";

/** Presentational chat panel — all state lives in the meeting room. */
export function MeetingChat({
  messages,
  loading,
  me,
  typing,
  onSend,
  onRetry,
  onTyping,
}: {
  messages: ChatMessage[];
  loading: boolean;
  me: string | null;
  typing: string[];
  onSend: (body: string) => void;
  onRetry: (id: string) => void;
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing.length]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    onSend(body);
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
          messages.map((m) =>
            m.sender_id === "system" ? (
              <p key={m.id} className="text-[11px] text-muted-foreground text-center">
                {m.body}
              </p>
            ) : (
              <div key={m.id} className="flex gap-2">
                <div className="w-7 h-7 shrink-0 rounded-full bg-secondary grid place-items-center text-[11px] font-semibold">
                  {m.sender_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">
                    {m.sender_id === me ? "You" : m.sender_name} ·{" "}
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {m.pending && " · sending"}
                  </div>
                  <div
                    className={`text-sm break-words whitespace-pre-wrap ${m.pending ? "opacity-60" : ""}`}
                  >
                    {m.body}
                  </div>
                  {m.failed && (
                    <button
                      onClick={() => onRetry(m.id)}
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-destructive hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" /> Not sent — retry
                    </button>
                  )}
                </div>
              </div>
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>
      {typing.length > 0 && (
        <div className="px-4 pb-1 text-[11px] text-muted-foreground">
          {typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…
        </div>
      )}
      <div className="p-3 border-t flex gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message the room"
          aria-label="Message"
        />
        <Button size="icon" onClick={submit} disabled={!text.trim()} aria-label="Send message">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
