## Orbital Connect — Web MVP

A light-themed productivity dashboard (matching image 2) with a fully working screen recorder, cloud-backed library, and shareable playback links. Live video calls and calendar/teammates data are UI-only placeholders in this phase.

### Scope

**Built for real:**
- Screen recording (Full Screen / Window / Region via `getDisplayMedia`)
- Mic + system audio toggles, live preview, 3-2-1 countdown, stop/pause
- Auth (email/password + Google) via Lovable Cloud
- Recordings upload to Cloud storage; metadata stored in Postgres
- Public share page `/v/:id` with video player (Loom-style)
- Library page: list of user's recordings, copy link, delete, rename
- "Copy link" appears within ~2s of stop (upload continues in background)

**Mocked / UI only (clearly labeled):**
- Meet pane (Instant Meeting, Scheduled Today, Active Teammates)
- Calendar page
- Settings page (basic profile only)

### Design

Match image 2 exactly:
- Left sidebar (Dashboard / Library / Calendar / Settings, Quick Call CTA, Help / Sign Out at bottom)
- Top search bar + notifications + help + avatar
- Two-column dashboard: **Record** (left) and **Meet** (right)
- Green primary (Orbital green), blue accent for Instant Meeting card
- Inter/SF-style sans, rounded cards, soft shadows, light grey background

### Pages / Routes

```
/                       → redirect to /dashboard (or /auth if signed out)
/auth                   → sign in / sign up
/_authenticated/dashboard   → Record + Meet split view (main screen from image 2)
/_authenticated/library     → grid/list of recordings
/_authenticated/calendar    → placeholder
/_authenticated/settings    → profile
/v/$id                  → public share page for a recording
```

### Data model

```
recordings
  id uuid pk
  user_id uuid → auth.users
  title text
  storage_path text          -- path in 'recordings' bucket
  duration_seconds int
  size_bytes bigint
  mime_type text
  thumbnail_path text nullable
  created_at timestamptz
  view_count int default 0
  is_public bool default true
```

RLS: owner full CRUD; anon SELECT only when `is_public = true` (public share page reads via server function).

Storage: `recordings` bucket (public read for MVP simplicity of share links).

### Technical notes

- Recorder uses `MediaRecorder` with `video/webm; codecs=vp9` (fallback to vp8), same pattern as the HTML you provided.
- After Stop: create DB row → generate share URL immediately → kick off upload in background → update row with final size/duration when done.
- Share URL format: `https://<app>/v/<id>` — copied to clipboard the instant recording stops.
- Server functions handle: create recording row, get signed upload URL, finalize upload, fetch public recording.
- All Meet-side buttons show a toast "Live calling coming soon" so nothing looks broken.

### Out of scope this phase
- WebRTC live calls / LiveKit
- Real teammates presence
- Calendar integration
- Video trimming/editing
- Thumbnails (placeholder tile for now)

Ready to build on approval.