-- Recordings: chunked upload + meeting link
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parts_count integer NOT NULL DEFAULT 0;

-- Helper: is the current user a member of the team owning this meeting?
CREATE OR REPLACE FUNCTION public.can_access_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meetings m
    JOIN public.team_members tm ON tm.team_id = m.team_id
    WHERE m.id = _meeting_id AND tm.user_id = _user_id
  );
$$;

-- Chat
CREATE TABLE public.meeting_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT 'Teammate',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.meeting_messages TO authenticated;
GRANT ALL ON public.meeting_messages TO service_role;

ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read meeting messages"
  ON public.meeting_messages FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));

CREATE POLICY "Workspace members post meeting messages"
  ON public.meeting_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_meeting(meeting_id, auth.uid()));

CREATE POLICY "Authors delete own meeting messages"
  ON public.meeting_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX meeting_messages_meeting_created_idx
  ON public.meeting_messages (meeting_id, created_at);

-- Whiteboard
CREATE TABLE public.meeting_board_strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stroke jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.meeting_board_strokes TO authenticated;
GRANT ALL ON public.meeting_board_strokes TO service_role;

ALTER TABLE public.meeting_board_strokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read board"
  ON public.meeting_board_strokes FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));

CREATE POLICY "Workspace members draw on board"
  ON public.meeting_board_strokes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_access_meeting(meeting_id, auth.uid()));

CREATE POLICY "Workspace members clear board"
  ON public.meeting_board_strokes FOR DELETE TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));

CREATE INDEX meeting_board_strokes_meeting_created_idx
  ON public.meeting_board_strokes (meeting_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_board_strokes;