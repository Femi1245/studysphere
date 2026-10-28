-- StudySphere V2: learning intelligence + exam grading support

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS topic_label text,
  ADD COLUMN IF NOT EXISTS bank_question_id uuid REFERENCES public.bank_questions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_fingerprint text;

CREATE INDEX IF NOT EXISTS quiz_questions_topic_label_idx
  ON public.quiz_questions (user_id, topic_label);

ALTER TABLE public.student_recommendations
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS student_recommendations_user_kind_idx
  ON public.student_recommendations (user_id, kind)
  WHERE dismissed = false;

-- Aggregated topic performance across attempts (not a single quiz)
CREATE TABLE IF NOT EXISTS public.topic_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  topic_key text NOT NULL,
  catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  incorrect_count integer NOT NULL DEFAULT 0 CHECK (incorrect_count >= 0),
  correct_count integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  distinct_attempts integer NOT NULL DEFAULT 0 CHECK (distinct_attempts >= 0),
  last_incorrect_at timestamptz,
  last_correct_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_key)
);

CREATE INDEX IF NOT EXISTS topic_performance_user_idx
  ON public.topic_performance (user_id, incorrect_count DESC);

ALTER TABLE public.topic_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY topic_performance_select_own ON public.topic_performance
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY topic_performance_insert_own ON public.topic_performance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY topic_performance_update_own ON public.topic_performance
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY topic_performance_delete_own ON public.topic_performance
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER topic_performance_set_updated_at
  BEFORE UPDATE ON public.topic_performance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Track questions used in prior attempts for smarter retries (optional fingerprint store)
CREATE TABLE IF NOT EXISTS public.quiz_question_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  bank_question_id uuid REFERENCES public.bank_questions (id) ON DELETE CASCADE,
  source_fingerprint text,
  attempt_id uuid REFERENCES public.quiz_attempts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_question_usage_user_course_idx
  ON public.quiz_question_usage (user_id, catalogue_course_id, created_at DESC);

ALTER TABLE public.quiz_question_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY quiz_question_usage_select_own ON public.quiz_question_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY quiz_question_usage_insert_own ON public.quiz_question_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY quiz_question_usage_delete_own ON public.quiz_question_usage
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.platform_settings (key, value)
VALUES
  ('learning_min_incorrect', '2'::jsonb),
  ('learning_min_attempts', '2'::jsonb)
ON CONFLICT (key) DO NOTHING;
