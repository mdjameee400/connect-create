-- Engagement, collaboration and utility tables for meetings

CREATE TABLE public.meeting_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_polls TO authenticated;
GRANT ALL ON public.meeting_polls TO service_role;
ALTER TABLE public.meeting_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read polls" ON public.meeting_polls FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members create polls" ON public.meeting_polls FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "authors update polls" ON public.meeting_polls FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "authors delete polls" ON public.meeting_polls FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE TABLE public.meeting_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.meeting_polls(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_poll_votes TO authenticated;
GRANT ALL ON public.meeting_poll_votes TO service_role;
ALTER TABLE public.meeting_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read poll votes" ON public.meeting_poll_votes FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members cast poll votes" ON public.meeting_poll_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid() AND public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "voters change own vote" ON public.meeting_poll_votes FOR UPDATE TO authenticated
  USING (voter_id = auth.uid()) WITH CHECK (voter_id = auth.uid());
CREATE POLICY "voters remove own vote" ON public.meeting_poll_votes FOR DELETE TO authenticated
  USING (voter_id = auth.uid());

CREATE TABLE public.meeting_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Teammate',
  body text NOT NULL,
  answered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_questions TO authenticated;
GRANT ALL ON public.meeting_questions TO service_role;
ALTER TABLE public.meeting_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read questions" ON public.meeting_questions FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members ask questions" ON public.meeting_questions FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members mark questions" ON public.meeting_questions FOR UPDATE TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()))
  WITH CHECK (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "authors delete questions" ON public.meeting_questions FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TABLE public.meeting_question_votes (
  question_id uuid NOT NULL REFERENCES public.meeting_questions(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, voter_id)
);
GRANT SELECT, INSERT, DELETE ON public.meeting_question_votes TO authenticated;
GRANT ALL ON public.meeting_question_votes TO service_role;
ALTER TABLE public.meeting_question_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read question votes" ON public.meeting_question_votes FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members upvote questions" ON public.meeting_question_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid() AND public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members remove own upvote" ON public.meeting_question_votes FOR DELETE TO authenticated
  USING (voter_id = auth.uid());

CREATE TABLE public.meeting_notes (
  meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.meeting_notes TO authenticated;
GRANT ALL ON public.meeting_notes TO service_role;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read notes" ON public.meeting_notes FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members create notes" ON public.meeting_notes FOR INSERT TO authenticated
  WITH CHECK (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members edit notes" ON public.meeting_notes FOR UPDATE TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()))
  WITH CHECK (public.can_access_meeting(meeting_id, auth.uid()));

CREATE TABLE public.meeting_breakouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_breakouts TO authenticated;
GRANT ALL ON public.meeting_breakouts TO service_role;
ALTER TABLE public.meeting_breakouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read breakouts" ON public.meeting_breakouts FOR SELECT TO authenticated
  USING (public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "members create breakouts" ON public.meeting_breakouts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_access_meeting(meeting_id, auth.uid()));
CREATE POLICY "creators update breakouts" ON public.meeting_breakouts FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "creators delete breakouts" ON public.meeting_breakouts FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE TABLE public.recording_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  label text NOT NULL,
  offset_seconds integer NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recording_chapters_recording ON public.recording_chapters (recording_id, offset_seconds);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_chapters TO authenticated;
GRANT SELECT ON public.recording_chapters TO anon;
GRANT ALL ON public.recording_chapters TO service_role;
ALTER TABLE public.recording_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads chapters of viewable recordings" ON public.recording_chapters FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.recordings r WHERE r.id = recording_id));
CREATE POLICY "owners add chapters" ON public.recording_chapters FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.recordings r WHERE r.id = recording_id AND r.user_id = auth.uid()));
CREATE POLICY "owners delete chapters" ON public.recording_chapters FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recordings r WHERE r.id = recording_id AND r.user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_question_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_breakouts;