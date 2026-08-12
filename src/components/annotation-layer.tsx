import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Point = { x: number; y: number };
type Line = { id: string; points: Point[]; color: string };

/**
 * Ephemeral annotation layer drawn on top of the video grid / shared screen.
 * Strokes are broadcast live and never persisted — clearing wipes them for
 * everyone.
 */
export function AnnotationLayer({
  meetingId,
  active,
  color = "#dc2626",
  clearSignal,
}: {
  meetingId: string;
  active: boolean;
  color?: string;
  clearSignal: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<Line[]>([]);
  const drawingRef = useRef<Line | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastFlush = useRef(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(canvas.width, 0, 0, canvas.height, 0, 0);
    ctx.clearRect(0, 0, 1, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = [...linesRef.current, ...(drawingRef.current ? [drawingRef.current] : [])];
    for (const l of all) {
      if (!l.points.length) continue;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 4 / canvas.width;
      ctx.beginPath();
      ctx.moveTo(l.points[0]!.x, l.points[0]!.y);
      for (const p of l.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`annot:${meetingId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "annot" }, ({ payload }) => {
        const l = payload as Line;
        const i = linesRef.current.findIndex((x) => x.id === l.id);
        if (i >= 0) linesRef.current[i] = l;
        else linesRef.current.push(l);
        redraw();
      })
      .on("broadcast", { event: "annot:clear" }, () => {
        linesRef.current = [];
        redraw();
      })
      .subscribe();
    channelRef.current = channel;
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      supabase.removeChannel(channel);
    };
  }, [meetingId, redraw]);

  useEffect(() => {
    if (clearSignal === 0) return;
    linesRef.current = [];
    drawingRef.current = null;
    redraw();
    channelRef.current?.send({ type: "broadcast", event: "annot:clear", payload: {} });
  }, [clearSignal, redraw]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full rounded-xl touch-none ${
        active ? "cursor-crosshair" : "pointer-events-none"
      }`}
      onPointerDown={(e) => {
        if (!active) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawingRef.current = { id: crypto.randomUUID(), points: [at(e)], color };
        redraw();
      }}
      onPointerMove={(e) => {
        if (!active || e.buttons === 0 || !drawingRef.current) return;
        drawingRef.current.points.push(at(e));
        redraw();
        const now = Date.now();
        if (now - lastFlush.current > 60) {
          lastFlush.current = now;
          channelRef.current?.send({
            type: "broadcast",
            event: "annot",
            payload: { ...drawingRef.current, points: [...drawingRef.current.points] },
          });
        }
      }}
      onPointerUp={() => {
        const l = drawingRef.current;
        drawingRef.current = null;
        if (!l) return;
        linesRef.current.push(l);
        redraw();
        channelRef.current?.send({ type: "broadcast", event: "annot", payload: l });
      }}
    />
  );
}
