# Collaboration + Scheduled Meetings

Two connected features layered onto the existing Orbital Connect MVP.

## 1. Teams & teammate invitations

Introduce a lightweight **team** concept (one team per owner to start). The owner invites teammates by email; invitees accept via a magic link and join the team. Every recording created by any team member is visible to the whole team in the Library.

### Data model (new tables)

```text
teams
  id uuid pk
  name text                 -- defaults to "<owner name>'s team"
  owner_id uuid → auth.users
  created_at timestamptz

team_members
  team_id uuid → teams
  user_id uuid → auth.users
  role text ('owner' | 'member')
  joined_at timestamptz
  pk (team_id, user_id)

team_invites
  id uuid pk
  team_id uuid → teams
  email citext
  token uuid (unique, url-safe)
  invited_by uuid → auth.users
  status text ('pending' | 'accepted' | 'revoked')
  created_at, accepted_at timestamptz
```

`recordings` gains a nullable `team_id uuid` column. New recordings are stamped with the creator's active team. Library query returns recordings where `user_id = auth.uid()` **OR** `team_id IN (my teams)`.

### RLS

- `teams`: members SELECT; owner UPDATE/DELETE.
- `team_members`: members SELECT own team rows; owner INSERT/DELETE (via server fn).
- `team_invites`: owner full CRUD; anon can SELECT by exact `token` (for the accept page).
- `recordings`: existing owner policy + new "team members can SELECT" policy using a `SECURITY DEFINER` `is_team_member(team_id, uid)` helper to avoid RLS recursion.

Helper migration also seeds a personal team for each existing user via a backfill and adds a trigger on `handle_new_user` so new signups get one automatically.

### Server functions

- `inviteTeammate({ email })` — owner-only; creates `team_invites` row, returns share URL `/invite/:token`. (No email sending in this phase — owner copies the link and shares it, same "instant share link" pattern as recordings.)
- `acceptInvite({ token })` — authenticated; inserts `team_members`, marks invite accepted, redirects to `/dashboard`.
- `revokeInvite({ id })` / `removeMember({ userId })` — owner-only.
- `listTeammates()` — returns members + pending invites for the Meet panel.

### UI

- **Meet panel → Active Teammates** becomes real: shows accepted members with avatars + presence dot (online = signed-in in last 5 min, tracked via `profiles.last_seen_at` bumped on app load). "Invite" button opens a dialog: email input → creates invite → auto-copies `/invite/:token` link to clipboard and toasts "Invite link copied".
- **Settings → Team** section: list members, pending invites, revoke / remove actions.
- **Library**: unchanged UI, but rows now include teammates' recordings with a small "by <name>" line under the title.
- **New route `/invite/$token`**: public; if signed out shows a "Sign in to join <team name>" CTA that routes through `/auth?redirect=/invite/<token>`; if signed in, one-click "Join team" button.

## 2. Real scheduled meetings

Replace the placeholder "Scheduled Today" / "Coming soon" stubs with real meeting records.

### Data model

```text
meetings
  id uuid pk
  team_id uuid → teams
  created_by uuid → auth.users
  title text
  starts_at timestamptz
  duration_minutes int
  room_slug text unique       -- short random slug for the join URL
  notes text
  created_at, updated_at timestamptz
```

RLS: members of the team can SELECT/INSERT/UPDATE/DELETE their team's meetings.

### Server functions / actions

- `createMeeting({ title, starts_at, duration_minutes, notes })` — inserts row, generates unique 8-char `room_slug`, returns `{ id, join_url: '/m/<slug>' }`.
- `listMeetings({ range })` — upcoming or by date range.
- `deleteMeeting({ id })`.

### UI

- **Meet panel**:
  - "Instant Meeting" → creates a meeting with `starts_at = now()`, copies join URL, navigates to `/m/:slug`.
  - "Schedule" button → opens a compact dialog (title, date, time, duration, optional notes) → creates meeting → toast + copyable link.
  - "Scheduled Today" list becomes live: shows today's team meetings with time, title, "Copy link" and "Join".
- **Calendar page** replaces the placeholder with:
  - Month grid highlighting days that have meetings.
  - Right pane listing that day's meetings with join / edit / delete actions.
  - "New meeting" button in the header.
- **New public route `/m/$slug`**: shows meeting title, host, start time, and a big **Join** button. The join screen itself remains a stub ("Live call room — video calling coming in the next phase") since real WebRTC/LiveKit was explicitly out of scope; the value delivered now is real meeting records + shareable join URLs + calendar integration, matching how Loom/Calendly links behave before the room opens.

### Design

Everything reuses the existing light dashboard style: green primary, soft cards, rounded inputs, blue accent for "Instant Meeting". Dialogs use existing shadcn `Dialog` component. No new visual language.

## Out of scope (explicitly, this phase)

- Sending invite emails via SMTP (owner shares the copied link — matches the app's core "instant link" pattern).
- Actual WebRTC video inside the meeting room (`/m/:slug` shows meeting info + placeholder for now).
- Recurring meetings, calendar sync (Google/Outlook), timezone picker (uses browser timezone).
- Multiple teams per user / switching teams.
- Roles beyond owner/member.

Ready to build on approval.