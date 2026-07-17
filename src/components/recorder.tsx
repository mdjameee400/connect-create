import { useEffect, useRef, useState } from "react";
import { Video, Monitor, AppWindow, Crop, Mic, Volume2, Play, Square, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

type Mode = "screen" | "window" | "region";

const MODES: { id: Mode; label: string; icon: typeof Monitor; hint: DisplayCaptureSurfaceType }[] = [
  { id: "screen", label: "Full Screen", icon: Monitor, hint: "monitor" },
  { id: "window", label: "Window", icon: AppWindow, hint: "window" },
  { id: "region", label: "Region", icon: Crop, hint: "browser" },
];

type DisplayCaptureSurfaceType = "monitor" | "window" | "browser";

export function Recorder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const [mode, setMode] = useState<Mode>("screen");
  const [mic, setMic] = useState(true);
  const [sys, setSys] = useState(false);
  const [state, setState] = useState<"idle" | "countdown" | "recording" | "processing">("idle");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [state]);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const beginRecording = async () => {
    try {
      const constraints: MediaStreamConstraints & Record<string, unknown> = {
        video: { frameRate: { ideal: 30 }, displaySurface: MODES.find((m) => m.id === mode)?.hint },
        audio: sys,
      };
      const displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);

      let combined = displayStream;
      if (mic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          combined = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...displayStream.getAudioTracks(),
            ...micStream.getAudioTracks(),
          ]);
        } catch {
          toast.warning("Microphone unavailable — recording without mic");
        }
      }

      streamRef.current = combined;
      if (videoRef.current) {
        videoRef.current.srcObject = combined;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      // Countdown
      setState("countdown");
      for (let n = 3; n > 0; n--) {
        setCount(n);
        await new Promise((r) => setTimeout(r, 700));
      }

      // If user stopped share during countdown
      if (!combined.getVideoTracks()[0] || combined.getVideoTracks()[0].readyState === "ended") {
        stopTracks();
        setState("idle");
        return;
      }

      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const rec = new MediaRecorder(combined, { mimeType: mime });
      recorderRef.current = rec;
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => finalize(mime);
      combined.getVideoTracks()[0].addEventListener("ended", () => {
        if (rec.state !== "inactive") rec.stop();
      });
      rec.start(1000);
      startedAtRef.current = Date.now();
      setState("recording");
      setElapsed(0);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start recording — permission denied?");
      setState("idle");
      stopTracks();
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const finalize = async (mime: string) => {
    setState("processing");
    const durationSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
    const blob = new Blob(chunksRef.current, { type: mime });
    stopTracks();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { toast.error("Session expired"); setState("idle"); return; }

    // Stamp recording with the user's primary team so teammates see it
    const { data: teamRow } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const teamId = teamRow?.team_id ?? null;

    const id = crypto.randomUUID();
    const path = `${user.id}/${id}.webm`;

    // Create DB row first so share link is instantly available
    const title = `Recording · ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    const { data: row, error: dbErr } = await supabase.from("recordings").insert({
      id,
      user_id: user.id,
      team_id: teamId,
      title,
      storage_path: path,
      duration_seconds: durationSec,
      size_bytes: blob.size,
      mime_type: mime,
      upload_status: "uploading",
    }).select().single();

    if (dbErr || !row) {
      toast.error("Couldn't save recording metadata");
      console.error(dbErr);
      setState("idle");
      return;
    }

    const shareUrl = `${window.location.origin}/v/${id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied — upload in progress", {
        description: shareUrl,
        action: { label: "Open", onClick: () => navigate({ to: "/v/$id", params: { id } }) },
      });
    } catch {
      toast.success("Recording saved — link ready in Library");
    }

    setState("idle");
    queryClient.invalidateQueries({ queryKey: ["recordings"] });

    // Upload in background
    (async () => {
      const { error: upErr } = await supabase.storage.from("recordings").upload(path, blob, {
        contentType: mime, upsert: false,
      });
      if (upErr) {
        console.error(upErr);
        await supabase.from("recordings").update({ upload_status: "failed" }).eq("id", id);
        toast.error("Upload failed — recording kept locally only");
        return;
      }
      await supabase.from("recordings").update({ upload_status: "ready" }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recording", id] });
    })();
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Video className="w-5 h-5 text-brand" />
        <h2 className="text-2xl font-semibold">Record</h2>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-3">
        {MODES.map((m) => {
          const active = mode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              disabled={state !== "idle"}
              className={`rounded-xl border-2 py-6 flex flex-col items-center gap-2 transition-colors ${
                active ? "border-brand bg-brand-soft" : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <Icon className={`w-6 h-6 ${active ? "text-brand" : "text-foreground/70"}`} />
              <span className={`text-sm font-medium ${active ? "text-brand" : ""}`}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Preview */}
      <Card className="p-0 overflow-hidden bg-slate-900 aspect-video relative">
        <video ref={videoRef} className="w-full h-full object-contain" playsInline />
        {state === "idle" && (
          <div className="absolute inset-0 grid place-items-center text-slate-400 text-sm">
            <div className="text-center">
              <Video className="w-10 h-10 mx-auto mb-2 opacity-60" />
              Preview appears here once you start recording
            </div>
          </div>
        )}
        {state === "countdown" && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <div className="text-white text-[120px] font-bold leading-none">{count}</div>
          </div>
        )}
        {state === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-white text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            REC · {fmt(elapsed)}
          </div>
        )}
      </Card>

      {/* Audio toggles */}
      <Card className="p-0 divide-y">
        <div className="flex items-center gap-3 px-5 py-4">
          <Mic className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1 text-sm">Microphone Audio</span>
          <Switch checked={mic} onCheckedChange={setMic} disabled={state !== "idle"} />
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1 text-sm">System Audio</span>
          <Switch checked={sys} onCheckedChange={setSys} disabled={state !== "idle"} />
        </div>
      </Card>

      {/* Main CTA */}
      {state === "recording" || state === "countdown" ? (
        <Button size="lg" variant="destructive" className="w-full h-14 text-base gap-2" onClick={stop} disabled={state === "countdown"}>
          <Square className="w-4 h-4 fill-current" /> Stop Recording
        </Button>
      ) : state === "processing" ? (
        <Button size="lg" className="w-full h-14 text-base gap-2" disabled>
          <Loader2 className="w-4 h-4 animate-spin" /> Preparing share link…
        </Button>
      ) : (
        <Button size="lg" className="w-full h-14 text-base gap-2" onClick={beginRecording}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Start Recording
        </Button>
      )}
    </div>
  );
}
