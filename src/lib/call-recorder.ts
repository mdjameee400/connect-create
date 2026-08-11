import { ChunkedRecording } from "@/lib/chunked-recording";

export type Source = { id: string; stream: MediaStream; name: string };

type Tile = { id: string; el: HTMLVideoElement; name: string; node: MediaStreamAudioSourceNode | null };

const FPS = 15;

/**
 * Records a P2P meeting in the host's browser: every participant video is
 * composited onto a canvas, all audio tracks are mixed with WebAudio, and the
 * result is streamed to cloud storage chunk-by-chunk.
 *
 * The participant list is live — peers joining or leaving mid-recording are
 * added to / removed from the recorded grid.
 */
export class CallRecorder {
  private canvas = document.createElement("canvas");
  private tiles: Tile[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private ctx: AudioContext | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunked: ChunkedRecording | null = null;
  private startedAt = 0;
  private onVisibility = () => {
    if (document.hidden) this.pauseDraw();
    else this.resumeDraw();
  };

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
    const audioCtx = new AudioContext();
    this.ctx = audioCtx;
    this.dest = audioCtx.createMediaStreamDestination();

    for (const s of sources) await this.addSource(s);

    this.resumeDraw();
    document.addEventListener("visibilitychange", this.onVisibility);

    const canvasStream = this.canvas.captureStream(FPS);
    const mixed = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...this.dest.stream.getAudioTracks(),
    ]);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    this.chunked = new ChunkedRecording({ ...this.opts, mime });
    await this.chunked.start();

    const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
    rec.ondataavailable = (e) => this.chunked?.push(e.data);
    rec.start(5000);
    this.recorder = rec;
    this.startedAt = Date.now();
  }

  /** Add a participant to the recorded grid while recording is running. */
  async addSource(s: Source) {
    if (this.tiles.some((t) => t.id === s.id)) return;
    const el = document.createElement("video");
    el.srcObject = s.stream;
    el.muted = true;
    el.playsInline = true;
    await el.play().catch(() => {});

    let node: MediaStreamAudioSourceNode | null = null;
    const audio = s.stream.getAudioTracks();
    if (this.ctx && this.dest && audio.length) {
      node = this.ctx.createMediaStreamSource(new MediaStream(audio));
      node.connect(this.dest);
    }
    this.tiles.push({ id: s.id, el, name: s.name, node });
  }

  /** Remove a participant who left mid-recording. */
  removeSource(id: string) {
    const tile = this.tiles.find((t) => t.id === id);
    if (!tile) return;
    try { tile.node?.disconnect(); } catch { /* ignore */ }
    tile.el.srcObject = null;
    this.tiles = this.tiles.filter((t) => t.id !== id);
  }

  private pauseDraw() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private resumeDraw() {
    if (this.timer) return;
    this.timer = setInterval(() => this.draw(), Math.round(1000 / FPS));
  }

  private draw() {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = this.canvas;
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, width, height);
    const n = Math.max(this.tiles.length, 1);
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const cw = width / cols;
    const ch = height / rows;
    ctx.font = "16px sans-serif";
    this.tiles.forEach((v, i) => {
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
      ctx.fillText(v.name, x + 24, y + ch - 22);
    });
  }

  async stop() {
    const rec = this.recorder;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
    }
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.pauseDraw();
    this.tiles.forEach((t) => {
      try { t.node?.disconnect(); } catch { /* ignore */ }
      t.el.srcObject = null;
    });
    this.tiles = [];
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.dest = null;
    const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
    const id = this.chunked?.id ?? null;
    const result = await this.chunked?.finalize(seconds);
    this.recorder = null;
    this.chunked = null;
    return { ok: result?.ok ?? false, id };
  }
}
