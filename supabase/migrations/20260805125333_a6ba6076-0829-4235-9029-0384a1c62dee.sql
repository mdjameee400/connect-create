DROP POLICY IF EXISTS "Anyone can view meeting by slug (join page)" ON public.meetings;

CREATE POLICY "Team members can view meetings"
  ON public.meetings FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

REVOKE SELECT ON public.meetings FROM anon;