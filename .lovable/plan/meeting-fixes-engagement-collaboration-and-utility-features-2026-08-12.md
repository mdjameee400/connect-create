# Meeting fixes + engagement, collaboration and utility features

## Part 1 — Bug fixes (first)

### Chat: 404 and false "Not sent — retry"
The chat table, grants and access policies exist in the backend, so the 404 is not a missing table. The cause is not yet confirmed, so the first step is to reproduce a real send in a live meeting and read the exact failing request (status, body, and whether the request carries a signed-in session).

Known candidates to check in that order:
- The request going out without the signed-in user's token (a signed-out or guest viewer of a meeting), which the backend reports as "not found" rather than "not allowed".
- A message sent for a meeting the sender's workspace does not own (link opened for another team's meeting).
- The optimistic message being marked failed even when the save succeeded, because the "failed" flag is set from a stale value rather than the actual save result.

Fixes:
- Send chat only once the user session is confirmed; show a clear "reconnecting" state instead of a silent failure.
- Mark a message failed only when the save genuinely errored, and surface the real reason in a toast.
- Keep the retry button, but retry the same message in place instead of re-creating it.

### Screen recording
- Mic + system audio are currently attached as two separate audio tracks; browsers record only the first, so takes come out with wrong or missing sound. Mix both into one track before recording.
- Guard against the capture being cancelled or ended during the countdown, and against starting a second recorder while one is running.
- Make in-meeting recording and standalone screen recording able to run at the same time without either stealing the other's audio graph.
- Verify the upload/stitch path end to end and surface an actionable error when a part fails, so a take is never silently lost.

## Part 2 — Engagement

- **Polls**: host creates a poll (question + options), everyone votes live, results bar-chart updates in real time, host can close the poll.
- **Q&A**: attendees post questions, upvote others, host can mark answered; sorted by votes.
- **Floating emoji reactions**: click a reaction and an animated emoji floats up on every participant's screen.
- **Soundboard**: host-only short sound effects (applause, drumroll, ding) played for the room.

## Part 3 — Collaboration

- **Whiteboard**: keep the existing shared board, add shapes (line, rectangle, ellipse), text, colour/width picker, and per-user cursors.
- **Screen annotation**: draw over the shared screen while presenting; annotations clear on demand.
- **Collaborative notepad**: a shared text pane in the meeting, synced live and saved with the meeting.

## Part 4 — Utility & media

- **Breakout rooms**: host creates named rooms and assigns participants; assigned people move to a sub-room of the same meeting and can return to the main room. Host can broadcast a message and close all rooms.
- **Playback chapters**: mark timestamps during a recording (auto for "recording started", manual "add chapter"), shown as a clickable chapter list on the playback page.
- **PDF export**: one click exports the chat transcript, notepad and a whiteboard snapshot to a PDF.

## Technical notes

- New tables (all with grants + row-level policies scoped through the existing meeting-access check, and added to the realtime feed): `meeting_polls`, `meeting_poll_votes`, `meeting_questions`, `meeting_question_votes`, `meeting_notes`, `meeting_breakouts`, `meeting_breakout_members`, `recording_chapters`.
- Ephemeral things (emoji reactions, soundboard triggers, live cursors, annotation strokes) go over the existing `room:${slug}` realtime broadcast, not the database.
- Breakout rooms reuse the current peer mesh: joining a breakout swaps the signalling channel to `room:${slug}:b:${breakoutId}` and tears down main-room peers; returning swaps back.
- New UI lives in a right-hand meeting panel with tabs (Chat, Board, Notes, Polls, Q&A, Rooms) so the room layout stays unchanged.
- Recorder audio mixing uses a WebAudio graph combining mic + system into a single track, owned per-recorder instance so the meeting recorder and screen recorder never share it.
- PDF export uses a client-side PDF library (`jspdf`) with the whiteboard canvas exported as an image.
- Also fixing: the server-side backend environment variables are missing in this preview, which throws on server render; wiring those up is part of the bug-fix pass.

## Suggested order

1. Bug fixes (chat + recorder) — verified in a real two-user meeting.
2. Engagement (polls, Q&A, reactions, soundboard).
3. Collaboration (whiteboard tools, annotation, notepad).
4. Utility (breakout rooms, chapters, PDF export).
