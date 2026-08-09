# In-Meeting Chat, Whiteboard & Cloud Recording

Staying on the current peer-to-peer calling stack (no SFU for now). Three additions.

## 1. Live chunked cloud upload for screen recordings

Today the recorder keeps all chunks in browser memory and uploads one file after you press stop — if the tab crashes mid-recording, everything is lost.

New behaviour:
- Each chunk is uploaded to cloud storage as it is produced, under `userId/recordingId/part-0001.webm`.
- The recording row is created when recording starts, with a live-updating status (`recording` → `uploading` → `ready` / `failed`) and a running duration/size.
- On stop, the parts are stitched into a single playable file and stored at the final path; the parts are removed.
- If the tab dies, the row stays with the parts intact and is marked `interrupted`, and the Library shows a "Resume/finalize" action to stitch what was captured.

## 2. Record the meeting itself

A Record button inside the meeting room, available to the meeting host:
- Captures the host's mixed view of the call (local camera + all remote audio/video composited into a canvas grid, plus mixed audio).
- Uses the same chunked cloud upload path above, so the call recording lands in the Library like any other recording, tagged to the workspace and linked to the meeting.
- Every participant sees a "Recording" indicator while it runs.

Note: with peer-to-peer, the recording is produced in the host's browser, so the host must stay in the call for the duration. A server-side SFU recording would remove that limit later.

## 3. In-meeting chat

- Slide-over panel next to the video grid, with unread badge on the toggle.
- Messages are stored in the database against the meeting, so people who join late see history and it stays after the call.
- Real-time delivery to all participants; sender name, avatar initial and timestamp.

## 4. Collaborative whiteboard

- Simple shared canvas overlay in the meeting: pen, a small colour set, adjustable stroke, eraser, undo, clear-all.
- Strokes broadcast live so everyone draws on the same board.
- Board contents persist per meeting, so rejoining or joining late shows the current board.
- Toggle between video grid and whiteboard, whiteboard visible to all participants at once.

Access rules stay as they are: only signed-in members of the host's workspace can open a meeting, read its chat, or draw on its board.

## Technical notes

- New tables: `meeting_messages` (meeting_id, sender_id, body) and `meeting_board_strokes` (meeting_id, author_id, stroke JSON). Both with team-member-only read/write policies and grants; Realtime enabled on both.
- `recordings` gains `parts_count` and reuses `upload_status` with the new states; a `meeting_id` column links call recordings to their meeting.
- Chunked upload: `MediaRecorder` with a 5s timeslice, each `ondataavailable` blob uploaded via the storage client; final stitch downloads parts, concatenates the Blob, uploads final object, deletes parts.
- Meeting recording composition: an offscreen `<canvas>` drawing each peer video tile on `requestAnimationFrame`, plus a `WebAudio` `MediaStreamDestination` mixing local mic and all remote audio tracks; `canvas.captureStream()` + mixed audio feeds the recorder.
- Chat and whiteboard use Supabase Realtime: strokes broadcast over the existing `room:${slug}` channel for low latency and written to the table for persistence; chat uses postgres_changes on `meeting_messages`.
- All new UI follows the existing monochrome/hatch design system.
