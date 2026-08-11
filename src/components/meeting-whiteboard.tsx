import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eraser, Trash2, Undo2 } from "lucide-react";

type Point = { x: number; y: number };
export type Stroke = {
  id: string;
  author: string;
  points: Point[];
  color: string;
  width: number;
};

const COLORS = ["#111111", "#6b7280", "#dc2626", "#2563eb", "#16a34a"];
const W = 1600;
const H = 900;
const FLUSH_MS = 60;

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

function hits(stroke: Stroke, p: Point, radius: number) {
  const r = radius + stroke.width / 2;
  if (stroke.points.length === 1) return Math.hypot(stroke.points[0]!.x - p.x, stroke.points[0]!.y - p.y) <= r;
  for (let i = 1; i < stroke.points.length; i++) {
    if (distanceToSegment(p, stroke.points[i - 1]!, stroke.points[i]!) <= r) return true;
  }
  return false;
}

export function MeetingWhiteboard({ meetingId }: { meetingId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const liveRef = useRef<Record<string, Stroke>>({});
  const drawingRef = useRef<Stroke | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meRef = useRef<string>(crypto.randomUUID());
  const lastFlush = useRef(0);
  const sentUpTo = useRef(0);

  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(4);
  const [erasing, setErasing] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(W * dpr);
    if (canvas.width !== targetW) {
      canvas.width = targetW;
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = [
      ...strokesRef.current,
      ...Object.values(liveRef.current),
      ...(drawingRef.current ? [drawingRef.current] : []),
    ];
    for (const s of all) {
      if (s.points.length < 1) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
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
      if (u.user?.id) meRef.current = u.user.id;
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
      .on("broadcast", { event: "stroke:progress" }, ({ payload }) => {
        const s = payload as Stroke;
        liveRef.current[s.id] = s;
        redraw();
      })
      .on("broadcast", { event: "stroke:commit" }, ({ payload }) => {
        const s = payload as Stroke;
        delete liveRef.current[s.id];
        if (!strokesRef.current.some((x) => x.id === s.id)) strokesRef.current.push(s);
        redraw();
      })
      .on("broadcast", { event: "stroke:remove" }, ({ payload }) => {
        const { ids } = payload as { ids: string[] };
        strokesRef.current = strokesRef.current.filter((s) => !ids.includes(s.id));
        ids.forEach((id) => delete liveRef.current[id]);
        redraw();
      })
      .on("broadcast", { event: "clear" }, () => {
        strokesRef.current = [];
        liveRef.current = {};
        redraw();
      })
      .subscribe();
    channelRef.current = channel;

    const onResize = () => redraw();
    window.addEventListener("resize", onResize);

    return () => {
      active = false;
      window.removeEventListener("resize", onResize);
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

  const eraseAt = async (p: Point) => {
    const radius = width * 3;
    const hitIds = strokesRef.current.filter((s) => hits(s, p, radius)).map((s) => s.id);
    if (!hitIds.length) return;
    strokesRef.current = strokesRef.current.filter((s) => !hitIds.includes(s.id));
    redraw();
    channelRef.current?.send({ type: "broadcast", event: "stroke:remove", payload: { ids: hitIds } });
    for (const id of hitIds) {
      await supabase
        .from("meeting_board_strokes")
        .delete()
        .eq("meeting_id", meetingId)
        .eq("stroke->>id", id);
    }
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toBoard(e);
    if (erasing) {
      void eraseAt(p);
      drawingRef.current = null;
      return;
    }
    drawingRef.current = {
      id: crypto.randomUUID(),
      author: meRef.current,
      points: [p],
      color,
      width,
    };
    sentUpTo.current = 0;
    redraw();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 0) return;
    const p = toBoard(e);
    if (erasing) {
      void eraseAt(p);
      return;
    }
    const stroke = drawingRef.current;
    if (!stroke) return;
    stroke.points.push(p);
    redraw();
    const now = Date.now();
    if (now - lastFlush.current >= FLUSH_MS) {
      lastFlush.current = now;
      sentUpTo.current = stroke.points.length;
      channelRef.current?.send({
        type: "broadcast",
        event: "stroke:progress",
        payload: { ...stroke, points: [...stroke.points] },
      });
    }
  };

  const end = async () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (!stroke || stroke.points.length === 0) return;
    strokesRef.current.push(stroke);
    redraw();
    channelRef.current?.send({ type: "broadcast", event: "stroke:commit", payload: stroke });
    await supabase.from("meeting_board_strokes").insert({
      meeting_id: meetingId,
      author_id: meRef.current,
      stroke: JSON.parse(JSON.stringify(stroke)),
    });
  };

  const undo = async () => {
    const mine = [...strokesRef.current].reverse().find((s) => s.author === meRef.current);
    if (!mine) return;
    strokesRef.current = strokesRef.current.filter((s) => s.id !== mine.id);
    redraw();
    channelRef.current?.send({ type: "broadcast", event: "stroke:remove", payload: { ids: [mine.id] } });
    await supabase
      .from("meeting_board_strokes")
      .delete()
      .eq("meeting_id", meetingId)
      .eq("stroke->>id", mine.id);
  };

  const clearAll = async () => {
    strokesRef.current = [];
    liveRef.current = {};
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
        onPointerCancel={() => void end()}
        onPointerLeave={() => void end()}
        className="w-full aspect-video rounded-xl border bg-white touch-none cursor-crosshair"
      />
    </div>
  );
}
