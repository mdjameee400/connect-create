import { ChunkedRecording } from "@/lib/chunked-recording";

type Source = { stream: MediaStream; name: string };

/**
 * Records a P2P meeting in the host's browser: every participant video is
 * composited onto a canvas, all audio tracks are mixed with WebAudio, and the
 * result is streamed to cloud storage chunk-by-chunk.
 */
export class CallRecorder {
  private canvas = document.createElement("canvas");
  private videos: { el: HTMLVideoElement; name: string }[] = [];
  private raf = 0;
  private ctx: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunked: ChunkedRecording | null = null;
  private startedAt = 0;

  constructor(
    private readonly opts: {
      userId: string;
      teamId: string | null;
      meetingId: string;
      title: string;
    },
  ) {
    this.canvas.width = 1280;
    this.canvas.height = 720;
  }

  get recordingId() {
    return this.chunked?.id ?? null;
  }

  async start(sources: Source[]) {
    for (const s of sources) {
      const el = document.createElement("video");
      el.srcObject = s.stream;
      el.muted = true;
      el.playsInline = true;
      await el.play().catch(() => {});
      this.videos.push({ el, name: s.name });
    }

    const draw = () => {
      const ctx = this.canvas.getContext("2d");
      if (ctx) {
        const { width, height } = this.canvas;
        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(0, 0, width, height);
        const n = Math.max(this.videos.length, 1);
        const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
        const rows = Math.ceil(n / cols);
        const cw = width / cols;
        const ch = height / rows;
        this.videos.forEach((v, i) => {
          const x = (i % cols) * cw;
          const y = Math.floor(i / cols) * ch;
          try {
            ctx.drawImage(v.el, x + 4, y + 4, cw - 8, ch - 8);
          } catch {
            /* frame not ready */
          }
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(x + 12, y + ch - 40, ctx.measureText(v.name).width + 24, 26);
          ctx.fillStyle = "#ffffff";
          ctx.font = "16px sans-serif";
          ctx.fillText(v.name, x + 24, y + ch - 22);
        });
      }
      this.raf = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = this.canvas.captureStream(25);
    const audioCtx = new AudioContext();
    this.ctx = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    for (const s of sources) {
      if (!s.stream.getAudioTracks().length) continue;
      audioCtx.createMediaStreamSource(new MediaStream(s.stream.getAudioTracks())).connect(dest);
    }

    const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    this.chunked = new ChunkedRecording({ ...this.opts, mime });
    await this.chunked.start();

    const rec = new MediaRecorder(mixed, { mimeType: mime });
    rec.ondataavailable = (e) => this.chunked?.push(e.data);
    rec.start(5000);
    this.recorder = rec;
    this.startedAt = Date.now();
  }

  async stop() {
    const rec = this.recorder;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
    }
    cancelAnimationFrame(this.raf);
    this.videos.forEach((v) => {
      v.el.srcObject = null;
    });
    this.videos = [];
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
    const id = this.chunked?.id ?? null;
    const result = await this.chunked?.finalize(seconds);
    this.recorder = null;
    this.chunked = null;
    return { ok: result?.ok ?? false, id };
  }
}
