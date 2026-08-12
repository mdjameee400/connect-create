import { useEffect, useRef, useState } from "react";

export const REACTIONS = ["👍", "👏", "❤️", "😂", "🎉", "🙌"];

export const SOUNDS: { id: string; label: string; freqs: number[] }[] = [
  { id: "ding", label: "Ding", freqs: [880, 1320] },
  { id: "applause", label: "Applause", freqs: [220, 300, 440, 660] },
  { id: "drumroll", label: "Drumroll", freqs: [110, 130, 110, 150] },
];

/** Short synthesised effect — no audio assets to ship or load. */
export function playSound(id: string) {
  const preset = SOUNDS.find((s) => s.id === id);
  if (!preset || typeof window === "undefined") return;
  const ctx = new AudioContext();
  preset.freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = id === "applause" ? "sawtooth" : "sine";
    osc.frequency.value = f;
    const at = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.4);
  });
  setTimeout(() => void ctx.close().catch(() => {}), 1600);
}

type Floater = { id: string; emoji: string; left: number; name: string };

/** Floating emoji animation layer shown over the video grid. */
export function ReactionOverlay({
  incoming,
}: {
  incoming: { emoji: string; name: string; key: number } | null;
}) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const lastKey = useRef(0);

  useEffect(() => {
    if (!incoming || incoming.key === lastKey.current) return;
    lastKey.current = incoming.key;
    const f: Floater = {
      id: crypto.randomUUID(),
      emoji: incoming.emoji,
      name: incoming.name,
      left: 10 + Math.random() * 80,
    };
    setFloaters((prev) => [...prev, f]);
    const t = setTimeout(() => setFloaters((prev) => prev.filter((x) => x.id !== f.id)), 3000);
    return () => clearTimeout(t);
  }, [incoming]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {floaters.map((f) => (
        <span
          key={f.id}
          className="absolute bottom-2 text-3xl animate-emoji-float"
          style={{ left: `${f.left}%` }}
        >
          {f.emoji}
          <span className="block text-[10px] text-center text-muted-foreground">{f.name}</span>
        </span>
      ))}
    </div>
  );
}
