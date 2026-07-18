DROP POLICY IF EXISTS "Anyone can view meeting by slug (join page)" ON public.meetings;

CREATE POLICY "Anyone can view meeting by slug (join page)"
  ON public.meetings FOR SELECT TO anon, authenticated
  USING (true);
