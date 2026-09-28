import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm the Connect Orbital assistant. Ask me about recording, meetings, your library, teams or billing.",
};

const SUGGESTIONS = [
  "How do I record my screen?",
  "How do I invite a teammate?",
  "Who can join my meeting link?",
];

export function SiteAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const ask = async (raw: string) => {
    const content = raw.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setText("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m.content) }),
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text()) || "The assistant is unavailable right now.";
        setMessages([...next, { role: "assistant", content: msg }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) {
        setMessages([
          ...next,
          { role: "assistant", content: "Sorry — I couldn't put an answer together. Try rephrasing?" },
        ]);
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Network hiccup — please try that again." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] h-[27rem] flex flex-col rounded-xl border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3 hatch">
            <div>
              <p className="text-sm font-semibold tracking-tight">Ask Orbital</p>
              <p className="text-[11px] text-muted-foreground">Answers about this product</p>
            </div>
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words ${
                  m.role === "user"
                    ? "ml-auto bg-foreground text-background"
                    : "bg-secondary text-foreground"
                }`}
              >
                {m.content || <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void ask(s)}
                    className="text-[11px] rounded-full border px-2.5 py-1 hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
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
                  void ask(text);
                }
              }}
              placeholder="Ask about Connect Orbital"
              aria-label="Ask the assistant"
            />
            <Button size="icon" onClick={() => void ask(text)} disabled={busy || !text.trim()} aria-label="Send">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-foreground text-background grid place-items-center shadow-lg hover:scale-105 transition-transform"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>
    </>
  );
}
