-- Ensure quiz_questions has columns required by Examination Centre / AI-filled quizzes.
-- Safe to re-run. Apply in Supabase SQL Editor if exams fail with:
-- "Could not find the 'bank_question_id' column of 'quiz_questions'"

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS topic_label text;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS source_fingerprint text;

DO $$
BEGIN
  IF to_regclass('public.bank_questions') IS NOT NULL THEN
    ALTER TABLE public.quiz_questions
      ADD COLUMN IF NOT EXISTS bank_question_id uuid;
    BEGIN
      ALTER TABLE public.quiz_questions
        ADD CONSTRAINT quiz_questions_bank_question_id_fkey
        FOREIGN KEY (bank_question_id) REFERENCES public.bank_questions (id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  ELSE
    ALTER TABLE public.quiz_questions
      ADD COLUMN IF NOT EXISTS bank_question_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quiz_questions_topic_label_idx
  ON public.quiz_questions (user_id, topic_label);

CREATE INDEX IF NOT EXISTS quiz_questions_source_fingerprint_idx
  ON public.quiz_questions (user_id, source_fingerprint);

-- Also ensure quizzes has exam-centre columns commonly missing on partial DBs
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS catalogue_course_id uuid,
  ADD COLUMN IF NOT EXISTS bank_id uuid,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS pass_mark numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS question_count integer,
  ADD COLUMN IF NOT EXISTS is_timed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS randomized boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

NOTIFY pgrst, 'reload schema';
