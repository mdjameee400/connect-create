# Fix recording, chat and whiteboard — plus a site assistant

## 1. Screen & call recording

Problems in the current build:
- The recorder keeps every chunk in browser memory *and* uploads it, so a long call recording doubles memory use and gets sluggish.
- The call recorder takes a snapshot of participants when you press Record — anyone who joins after that never appears in the recording.
- The compositing loop redraws as fast as the screen refreshes, which competes with the call for CPU.

Fixes:
- Drop the in-memory copy: parts are uploaded as they are produced and the final file is stitched from the uploaded parts, so memory stays flat regardless of length.
- Keep the participant list live — people joining or leaving mid-recording are added to / removed from the recorded grid.
- Cap the composite at a steady 15 fps and pause drawing when the tab is hidden, so recording no longer competes with the video call.
- A "Recording" indicator is shown to everyone in the room, not only the host.
- Recording and screen capture can run at the same time without interfering.

## 2. Real-time chat

Problems:
- Messages travel only through the database change feed, so delivery can lag or silently stop if the feed is unavailable.
- The chat only listens while the panel is open, so the unread badge never counts messages received while it is closed.

Fixes:
- Messages send instantly over the live meeting channel and are saved to the database in parallel; the database copy is used for history and de-duplicated against the live one.
- Chat state moves up into the meeting room so messages arrive and the unread badge counts even when the panel is closed.
- Optimistic send (message appears immediately, marked failed with retry if it doesn't save), plus a "X is typing" indicator and join/leave notices.

## 3. Whiteboard

Problems:
- Strokes are only shared when you lift the pen, so others watch drawings appear in jumps.
- Undo can remove someone else's last stroke, and it re-broadcasts the whole board to resync.
- The eraser paints white instead of erasing, so it wipes anything under it permanently.
- The board only loads when its panel is open, and the side panel shows a redundant placeholder.

Fixes:
- Live streaming of stroke points while drawing (throttled batches), so everyone sees the pen move.
- Undo removes only your own last stroke, and removals broadcast as a targeted "remove stroke" event instead of a full board resend.
- Eraser removes strokes it touches rather than painting over them.
- Board stays mounted and synced whether or not it is on screen; the panel gets a proper participant/tool layout instead of the placeholder text.
- Canvas scales crisply on high-DPI screens and supports touch/stylus.

## 4. Website chatbot

A floating assistant on the public site and inside the app that answers questions about Orbital Connect — what it does, how recording, meetings, teams, invites and the library work, pricing, and troubleshooting (camera permissions, joining a meeting, etc.).

- Bubble bottom-right, opens a compact chat panel in the monochrome/hatch style.
- Streams answers, remembers the conversation for the session, and points users to the right page (Dashboard, Library, Calendar, Settings) with links.
- Grounded in a product knowledge summary so it doesn't invent features, and it declines off-topic requests politely.

### About the API key you pasted

Please treat that Google key as compromised and revoke/rotate it — it was posted in plain chat. It is also not needed: this project already has Lovable AI built in, so the chatbot runs on Google Gemini through it with no key to manage or pay for separately. If you specifically want your own Google key used instead, say so and I will request it through the secure secret form rather than chat.

## Technical notes

- `chunked-recording.ts`: remove `localChunks`; finalize downloads uploaded parts (or uses a storage-side concat) to stitch. `call-recorder.ts`: exposed `addSource`/`removeSource`, `setInterval`-driven 15 fps draw, `document.visibilitychange` pause.
- Chat: new `broadcast` events (`chat`, `typing`) on the existing `room:${slug}` channel; `meeting_messages` insert stays for history. Chat state lifted into `meeting-room.tsx`, `meeting-chat.tsx` becomes presentational.
- Whiteboard: `stroke:progress` / `stroke:commit` / `stroke:remove` broadcasts; hit-testing eraser deletes matching rows from `meeting_board_strokes`; devicePixelRatio-aware canvas sizing.
- Chatbot: `src/routes/api/chat.ts` TanStack server route streaming through the Lovable AI gateway (`google/gemini-3.6-flash`) with a product system prompt; `src/components/site-assistant.tsx` client widget mounted in `__root.tsx`. No database table — session-only history.
