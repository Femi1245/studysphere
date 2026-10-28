-- StudySphere V2: learning intelligence + exam grading support
-- Prerequisites (run in order first if missing):
--   1) 20260327000000_init.sql
--   2) 20260327120000_academic_upgrade.sql
--   3) (optional seeds) 20260327121000_nigeria_seed.sql, 20260327130000_*, 20260327140000_*

DO $$
BEGIN
  IF to_regclass('public.quiz_questions') IS NULL THEN
    RAISE EXCEPTION
      'Missing public.quiz_questions. Apply 20260327000000_init.sql before this V2 migration.';
  END IF;
  IF to_regclass('public.student_recommendations') IS NULL THEN
    RAISE EXCEPTION
      'Missing public.student_recommendations. Apply 20260327120000_academic_upgrade.sql before this V2 migration.';
  END IF;
  IF to_regclass('public.bank_questions') IS NULL THEN
    RAISE EXCEPTION
      'Missing public.bank_questions. Apply 20260327120000_academic_upgrade.sql before this V2 migration.';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION
      'Missing public.profiles. Apply 20260327000000_init.sql before this V2 migration.';
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'topic_performance'
      AND policyname = 'topic_performance_select_own'
  ) THEN
    CREATE POLICY topic_performance_select_own ON public.topic_performance
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'topic_performance'
      AND policyname = 'topic_performance_insert_own'
  ) THEN
    CREATE POLICY topic_performance_insert_own ON public.topic_performance
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'topic_performance'
      AND policyname = 'topic_performance_update_own'
  ) THEN
    CREATE POLICY topic_performance_update_own ON public.topic_performance
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'topic_performance'
      AND policyname = 'topic_performance_delete_own'
  ) THEN
    CREATE POLICY topic_performance_delete_own ON public.topic_performance
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'topic_performance_set_updated_at'
  ) THEN
    CREATE TRIGGER topic_performance_set_updated_at
      BEFORE UPDATE ON public.topic_performance
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Track questions used in prior attempts for smarter retries
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_question_usage'
      AND policyname = 'quiz_question_usage_select_own'
  ) THEN
    CREATE POLICY quiz_question_usage_select_own ON public.quiz_question_usage
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_question_usage'
      AND policyname = 'quiz_question_usage_insert_own'
  ) THEN
    CREATE POLICY quiz_question_usage_insert_own ON public.quiz_question_usage
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_question_usage'
      AND policyname = 'quiz_question_usage_delete_own'
  ) THEN
    CREATE POLICY quiz_question_usage_delete_own ON public.quiz_question_usage
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

INSERT INTO public.platform_settings (key, value)
VALUES
  ('learning_min_incorrect', '2'::jsonb),
  ('learning_min_attempts', '2'::jsonb)
ON CONFLICT (key) DO NOTHING;
