# Locked meetings + monochrome redesign

Two things: stop meeting links from working for strangers, and rebuild the whole look in a crafted black-and-white style.

## 1. Meeting links become team-only

Today `/m/<slug>` is a public page: anyone with the link types a name and joins, signed in or not. New rule: **you must be signed in AND be a member of the host's team.**

What people will see:
- **Signed out** — a locked meeting screen with the meeting title hidden, a short "This meeting is private" message and a Sign in button that returns them to the meeting after login.
- **Signed in, not on the team** — "You don't have access to this meeting. Ask the host to invite you to their workspace." with a link to how invites work.
- **Signed in team member** — the meeting details and Join room, exactly as now.

The guest-name prompt and the saved guest name go away; your workspace display name is used.

Invites stay the way to let someone in: host sends a workspace invite link from the dashboard, they accept, then the meeting link works for them.

## 2. Black-and-white redesign, whole app

New palette: near-black ink, pure white surfaces, a grey scale for structure, and one restrained accent used only for live/record states. Green branding is retired.

Landing page rebuilt Zoom/Linear-style:
- Sticky slim nav with the logo, wordmark, and Sign in / Get started.
- Full-bleed hero on a soft diagonal-hatch pattern: big tight headline, one-line subhead, primary + ghost CTA, and a crisp product mock below.
- Logo/trust strip, three-up feature cards with fine hairline borders, an alternating record → share → meet walkthrough, pricing, FAQ, and a bold black closing CTA band.
- Pattern used as a signature texture: engraved diagonal hatching in soft grey, in section dividers and behind the hero, never loud enough to fight the text.

Then the same system rolls through auth, dashboard, calendar, library, settings, the meeting page and the in-call room: white app surfaces, hairline borders, black primary buttons, generous spacing, subtle hover and focus motion. Simple, modern, daily-use.

## Technical notes

- New security-definer helper `public.is_team_member(_user_id, _team_id)` plus a replacement SELECT policy on `meetings` restricting reads to team members (drops the current anon-readable path). Requires a migration.
- `src/routes/m.$slug.tsx`: fetch the session first; render locked / no-access / allowed states. Drop `localStorage` guest name; pass the profile display name to `MeetingRoom`.
- Signalling channel `room:<slug>` gets an authorization check — presence/broadcast only after the membership query succeeds, so a stranger cannot bypass the UI and speak on the channel directly.
- `/auth` accepts a sanitized same-origin `redirect` search param and navigates there after sign-in.
- `src/styles.css`: replace `--brand*`, primary, sidebar and accent tokens with the monochrome scale; add a `@utility hatch` for the diagonal pattern so sections reuse one definition. Components keep using semantic tokens — no hardcoded colors.
- Logo recolored to monochrome ink (`src/components/logo.tsx`, `public/favicon.svg`).
- Route `head()` metadata refreshed per page during the pass.
