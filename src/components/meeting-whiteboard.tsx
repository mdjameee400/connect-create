import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eraser, Trash2, Undo2 } from "lucide-react";

type Point = { x: number; y: number };
export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  erase?: boolean;
};

const COLORS = ["#111111", "#6b7280", "#dc2626", "#2563eb", "#16a34a"];
const W = 1600;
const H = 900;

export function MeetingWhiteboard({ meetingId }: { meetingId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meRef = useRef<string | null>(null);

  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(4);
  const [erasing, setErasing] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = drawingRef.current ? [...strokesRef.current, drawingRef.current] : strokesRef.current;
    for (const s of all) {
      if (s.points.length < 1) continue;
      ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
      ctx.lineWidth = s.erase ? s.width * 4 : s.width;
      ctx.beginPath();
      ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
      if (s.points.length === 1) ctx.lineTo(s.points[0]!.x + 0.1, s.points[0]!.y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      meRef.current = u.user?.id ?? null;
      const { data } = await supabase
        .from("meeting_board_strokes")
        .select("stroke")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (!active) return;
      strokesRef.current = (data ?? []).map((r) => r.stroke as unknown as Stroke);
      redraw();
    })();

    const channel = supabase
      .channel(`board:${meetingId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const s = payload as Stroke;
        if (strokesRef.current.some((x) => x.id === s.id)) return;
        strokesRef.current.push(s);
        redraw();
      })
      .on("broadcast", { event: "clear" }, () => {
        strokesRef.current = [];
        redraw();
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [meetingId, redraw]);

  const toBoard = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = {
      id: crypto.randomUUID(),
      points: [toBoard(e)],
      color,
      width,
      erase: erasing,
    };
    redraw();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current.points.push(toBoard(e));
    redraw();
  };

  const end = async () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (!stroke || stroke.points.length === 0) return;
    strokesRef.current.push(stroke);
    redraw();
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload: stroke });
    if (meRef.current) {
      await supabase.from("meeting_board_strokes").insert({
        meeting_id: meetingId,
        author_id: meRef.current,
        stroke: stroke as unknown as Record<string, unknown>,
      });
    }
  };

  const undo = async () => {
    const mine = [...strokesRef.current].reverse().find(Boolean);
    if (!mine) return;
    strokesRef.current = strokesRef.current.filter((s) => s.id !== mine.id);
    redraw();
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
    // Re-broadcast remaining strokes so peers stay in sync after an undo.
    for (const s of strokesRef.current) {
      channelRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
    }
    await supabase.from("meeting_board_strokes").delete().eq("meeting_id", meetingId).eq("stroke->>id", mine.id);
  };

  const clearAll = async () => {
    strokesRef.current = [];
    redraw();
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
    await supabase.from("meeting_board_strokes").delete().eq("meeting_id", meetingId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Colour ${c}`}
            onClick={() => { setColor(c); setErasing(false); }}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${
              color === c && !erasing ? "border-foreground scale-110" : "border-border"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="range"
          min={2}
          max={16}
          value={width}
          aria-label="Stroke width"
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-28 accent-foreground"
        />
        <Button size="sm" variant={erasing ? "default" : "secondary"} className="gap-1.5" onClick={() => setErasing((v) => !v)}>
          <Eraser className="w-3.5 h-3.5" /> Eraser
        </Button>
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => void undo()}>
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </Button>
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => void clearAll()}>
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => void end()}
        onPointerLeave={() => void end()}
        className="w-full aspect-video rounded-xl border bg-white touch-none cursor-crosshair"
      />
    </div>
  );
}
