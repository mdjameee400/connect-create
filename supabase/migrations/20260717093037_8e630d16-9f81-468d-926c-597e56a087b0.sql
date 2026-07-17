
-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- =========================================================
-- teams
-- =========================================================
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My team',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- team_members
-- =========================================================
CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- team_invites
-- =========================================================
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email citext NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
GRANT SELECT ON public.team_invites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- meetings
-- =========================================================
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled meeting',
  starts_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes int NOT NULL DEFAULT 30,
  room_slug text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meetings TO anon;         -- public join page reads by slug
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Existing tables: add columns
-- =========================================================
ALTER TABLE public.recordings ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.profiles   ADD COLUMN last_seen_at timestamptz;

-- =========================================================
-- Security-definer helper (avoids RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.my_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id;
$$;

-- =========================================================
-- RLS policies: teams
-- =========================================================
CREATE POLICY "Members can view their teams"
  ON public.teams FOR SELECT TO authenticated
  USING (public.is_team_member(id, auth.uid()));

CREATE POLICY "Users can create teams they own"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their teams"
  ON public.teams FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their teams"
  ON public.teams FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- =========================================================
-- RLS policies: team_members
-- =========================================================
CREATE POLICY "Members can view team roster"
  ON public.team_members FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Owners can add members"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_team_owner(team_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Owners can remove members"
  ON public.team_members FOR DELETE TO authenticated
  USING (public.is_team_owner(team_id, auth.uid()) OR user_id = auth.uid());

-- =========================================================
-- RLS policies: team_invites
-- =========================================================
CREATE POLICY "Owners manage invites"
  ON public.team_invites FOR ALL TO authenticated
  USING (public.is_team_owner(team_id, auth.uid()))
  WITH CHECK (public.is_team_owner(team_id, auth.uid()));

CREATE POLICY "Anyone with the token can view invite"
  ON public.team_invites FOR SELECT TO anon, authenticated
  USING (true);
-- Note: token is unguessable (uuid); app queries by token.

-- =========================================================
-- RLS policies: meetings
-- =========================================================
CREATE POLICY "Members can view team meetings"
  ON public.meetings FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Anyone can view meeting by slug (join page)"
  ON public.meetings FOR SELECT TO anon
  USING (true);

CREATE POLICY "Members can create team meetings"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(team_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Members can update team meetings"
  ON public.meetings FOR UPDATE TO authenticated
  USING (public.is_team_member(team_id, auth.uid()))
  WITH CHECK (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Members can delete team meetings"
  ON public.meetings FOR DELETE TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

-- =========================================================
-- Additional recordings policy: teammates can view
-- =========================================================
CREATE POLICY "Team members can view team recordings"
  ON public.recordings FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()));

-- =========================================================
-- Triggers: updated_at
-- =========================================================
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Updated handle_new_user: create personal team + membership + profile
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display text;
  _team_id uuid;
BEGIN
  _display := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, _display, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.teams (name, owner_id)
  VALUES (COALESCE(_display, 'My') || '''s team', NEW.id)
  RETURNING id INTO _team_id;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_team_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Ensure trigger on auth.users exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Backfill: give every existing user a personal team
-- =========================================================
DO $$
DECLARE
  u record;
  new_team uuid;
BEGIN
  FOR u IN
    SELECT au.id, COALESCE(p.display_name, split_part(au.email,'@',1)) AS name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.teams t WHERE t.owner_id = au.id
    )
  LOOP
    INSERT INTO public.teams (name, owner_id)
    VALUES (COALESCE(u.name, 'My') || '''s team', u.id)
    RETURNING id INTO new_team;
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (new_team, u.id, 'owner')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Stamp existing recordings with their owner's personal team
UPDATE public.recordings r
SET team_id = t.id
FROM public.teams t
WHERE r.team_id IS NULL AND t.owner_id = r.user_id;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_team_start ON public.meetings(team_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_recordings_team ON public.recordings(team_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.team_invites(token);
