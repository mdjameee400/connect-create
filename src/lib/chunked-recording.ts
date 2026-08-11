import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a MediaRecorder stream to cloud storage chunk-by-chunk while it is
 * still recording, so a tab crash never loses the whole take.
 *
 * Layout:  {userId}/{recordingId}/part-0001.webm   (temporary parts)
 *          {userId}/{recordingId}.webm             (final stitched file)
 */
export const BUCKET = "recordings";

export const partPath = (userId: string, id: string, index: number) =>
  `${userId}/${id}/part-${String(index).padStart(4, "0")}.webm`;

export const finalPath = (userId: string, id: string) => `${userId}/${id}.webm`;

export type ChunkedRecordingOptions = {
  userId: string;
  teamId: string | null;
  meetingId?: string | null;
  title: string;
  mime: string;
};

export class ChunkedRecording {
  readonly id = crypto.randomUUID();
  private index = 0;
  private bytes = 0;
  private queue: Promise<void> = Promise.resolve();
  private failed = false;

  constructor(private readonly opts: ChunkedRecordingOptions) {}

  get storagePath() {
    return finalPath(this.opts.userId, this.id);
  }

  /** Create the DB row up-front so the share link exists immediately. */
  async start() {
    const { error } = await supabase.from("recordings").insert({
      id: this.id,
      user_id: this.opts.userId,
      team_id: this.opts.teamId,
      meeting_id: this.opts.meetingId ?? null,
      title: this.opts.title,
      storage_path: this.storagePath,
      duration_seconds: 0,
      size_bytes: 0,
      mime_type: this.opts.mime,
      upload_status: "recording",
      parts_count: 0,
    });
    if (error) throw error;
  }

  /**
   * Queue a chunk upload. Non-blocking; ordering is preserved and the blob is
   * released as soon as it is uploaded, so memory stays flat for long takes.
   */
  push(blob: Blob) {
    if (!blob.size || this.failed) return;
    const index = ++this.index;
    this.bytes += blob.size;
    const size = this.bytes;
    this.queue = this.queue.then(async () => {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(partPath(this.opts.userId, this.id, index), blob, {
          contentType: this.opts.mime,
          upsert: true,
        });
      if (error) {
        this.failed = true;
        console.error("chunk upload failed", error);
        await supabase.from("recordings").update({ upload_status: "failed" }).eq("id", this.id);
        return;
      }
      await supabase
        .from("recordings")
        .update({ parts_count: index, size_bytes: size })
        .eq("id", this.id);
    });
  }

  /** Wait for pending chunk uploads, then stitch the uploaded parts into one file. */
  async finalize(durationSeconds: number) {
    await this.queue;
    if (this.failed || this.index === 0) return { ok: false as const };

    await supabase
      .from("recordings")
      .update({ upload_status: "uploading", duration_seconds: durationSeconds })
      .eq("id", this.id);

    try {
      const blob = await stitchParts(this.opts.userId, this.id, this.index, this.opts.mime);
      const { error } = await supabase.storage.from(BUCKET).upload(this.storagePath, blob, {
        contentType: this.opts.mime,
        upsert: true,
      });
      if (error) throw error;

      await removeParts(this.opts.userId, this.id, this.index);
      await supabase
        .from("recordings")
        .update({
          upload_status: "ready",
          size_bytes: blob.size,
          duration_seconds: durationSeconds,
          parts_count: 0,
        })
        .eq("id", this.id);
      return { ok: true as const };
    } catch (err) {
      console.error(err);
      // Leave parts in place so the Library "Finalize" action can recover them.
      await supabase.from("recordings").update({ upload_status: "failed" }).eq("id", this.id);
      return { ok: false as const };
    }
  }
}

/** Download every uploaded part and concatenate them into a single blob. */
async function stitchParts(userId: string, id: string, count: number, mime: string) {
  const blobs: Blob[] = [];
  for (let i = 1; i <= count; i++) {
    const { data, error } = await supabase.storage.from(BUCKET).download(partPath(userId, id, i));
    if (error || !data) throw error ?? new Error(`Missing part ${i}`);
    blobs.push(data);
  }
  return new Blob(blobs, { type: mime });
}

async function removeParts(userId: string, id: string, count: number) {
  if (count <= 0) return;
  const paths = Array.from({ length: count }, (_, i) => partPath(userId, id, i + 1));
  await supabase.storage.from(BUCKET).remove(paths);
}


/**
 * Recover a recording whose tab died mid-capture: download every uploaded
 * part, stitch them and publish the final file.
 */
export async function finalizeInterrupted(rec: {
  id: string;
  user_id: string;
  parts_count: number;
  mime_type: string;
  storage_path: string;
}) {
  if (rec.parts_count <= 0) throw new Error("Nothing was uploaded for this recording.");
  const blobs: Blob[] = [];
  for (let i = 1; i <= rec.parts_count; i++) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(partPath(rec.user_id, rec.id, i));
    if (error || !data) throw error ?? new Error("Missing part");
    blobs.push(data);
  }
  const blob = new Blob(blobs, { type: rec.mime_type });
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(rec.storage_path, blob, { contentType: rec.mime_type, upsert: true });
  if (upErr) throw upErr;

  await removeParts(rec.user_id, rec.id, rec.parts_count);
  const { error } = await supabase
    .from("recordings")
    .update({ upload_status: "ready", size_bytes: blob.size, parts_count: 0 })
    .eq("id", rec.id);
  if (error) throw error;
}
