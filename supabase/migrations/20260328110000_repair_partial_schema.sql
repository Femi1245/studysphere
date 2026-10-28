-- StudySphere one-shot repair for partially applied databases.
-- Safe to re-run. Creates only what is missing, then applies academic + V2 pieces.
-- Run THIS file alone in the Supabase SQL editor (skip the broken partial runs).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Ensure profiles exists with required columns before is_admin() / other helpers
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  education_level text,
  school text,
  exam_goals text,
  preferred_study_duration integer,
  timezone text,
  learning_style text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial DBs often have profiles without later columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS exam_goals text,
  ADD COLUMN IF NOT EXISTS preferred_study_duration integer,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS learning_style text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill + constrain role if table predated the column
UPDATE public.profiles SET role = 'student' WHERE role IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'admin'));
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_ensure_trigger(p_trigger text, p_table regclass, p_fn text DEFAULT 'public.set_updated_at')
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = p_trigger AND NOT tgisinternal) THEN
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION %s()',
      p_trigger, p_table, p_fn
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_ensure_policy(
  p_name text,
  p_table regclass,
  p_cmd text,
  p_using text DEFAULT NULL,
  p_check text DEFAULT NULL,
  p_roles text DEFAULT 'authenticated'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rel text := p_table::text;
  tname text;
  sql text;
BEGIN
  tname := CASE WHEN rel LIKE '%.%' THEN split_part(rel, '.', 2) ELSE rel END;
  tname := replace(tname, '"', '');
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = tname
      AND policyname = p_name
  ) THEN
    RETURN;
  END IF;
  sql := format('CREATE POLICY %I ON %s FOR %s TO %s', p_name, p_table, p_cmd, p_roles);
  IF p_using IS NOT NULL THEN
    sql := sql || ' USING (' || p_using || ')';
  END IF;
  IF p_check IS NOT NULL THEN
    sql := sql || ' WITH CHECK (' || p_check || ')';
  END IF;
  BEGIN
    EXECUTE sql;
  EXCEPTION
    WHEN undefined_column THEN
      RAISE NOTICE 'Skipped policy % on % (missing column)', p_name, p_table;
    WHEN duplicate_object THEN
      NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_safe_sql(p_sql text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
EXCEPTION
  WHEN undefined_column THEN
    RAISE NOTICE 'Skipped SQL (missing column): %', left(p_sql, 160);
  WHEN duplicate_object THEN
    NULL;
  WHEN duplicate_table THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_has_column(p_table text, p_column text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  );
$$;

-- ---------------------------------------------------------------------------
-- Core tables (init) — profiles already ensured above
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  theme text,
  notify_tasks boolean NOT NULL DEFAULT true,
  notify_exams boolean NOT NULL DEFAULT true,
  notify_revision boolean NOT NULL DEFAULT true,
  notify_goals boolean NOT NULL DEFAULT true,
  focus_minutes integer NOT NULL DEFAULT 25,
  break_minutes integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- If an empty/wrong user_preferences shell exists, add user_id
DO $$
BEGIN
  IF to_regclass('public.user_preferences') IS NOT NULL
     AND NOT public.ss_has_column('user_preferences', 'user_id') THEN
    ALTER TABLE public.user_preferences
      ADD COLUMN user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE;
    -- Promote to PK when possible
    BEGIN
      ALTER TABLE public.user_preferences ADD PRIMARY KEY (user_id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS notify_tasks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_exams boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_revision boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_goals boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS focus_minutes integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  icon text,
  goal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.subjects') IS NOT NULL
     AND NOT public.ss_has_column('subjects', 'user_id') THEN
    ALTER TABLE public.subjects
      ADD COLUMN user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  name text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  needs_revision boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  scheduled_at timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  estimated_minutes integer,
  is_exam boolean NOT NULL DEFAULT false,
  is_revision boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  title text NOT NULL,
  content text,
  pinned boolean NOT NULL DEFAULT false,
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  note_id uuid REFERENCES public.notes (id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  prompt text NOT NULL,
  options jsonb,
  correct_answer text,
  explanation text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  score numeric,
  max_score numeric,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  answer text,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.flashcard_decks (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  ease_factor numeric NOT NULL DEFAULT 2.5,
  interval_days integer NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id uuid NOT NULL REFERENCES public.flashcards (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  quality integer NOT NULL CHECK (quality >= 0 AND quality <= 5),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text,
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure user_id (and other key cols) on tables that already existed with a thinner schema
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subjects','topics','study_tasks','study_sessions','notes','learning_resources',
    'quizzes','quiz_questions','quiz_attempts','quiz_answers','flashcard_decks',
    'flashcards','flashcard_reviews','notifications','support_requests',
    'ai_conversations','ai_messages'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND NOT public.ss_has_column(t, 'user_id') THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE',
        t
      );
    END IF;
  END LOOP;

  IF to_regclass('public.topics') IS NOT NULL THEN
    IF NOT public.ss_has_column('topics', 'subject_id') THEN
      ALTER TABLE public.topics ADD COLUMN subject_id uuid REFERENCES public.subjects (id) ON DELETE CASCADE;
    END IF;
    IF NOT public.ss_has_column('topics', 'needs_revision') THEN
      ALTER TABLE public.topics ADD COLUMN needs_revision boolean NOT NULL DEFAULT false;
    END IF;
  END IF;

  IF to_regclass('public.quiz_questions') IS NOT NULL AND NOT public.ss_has_column('quiz_questions', 'quiz_id') THEN
    ALTER TABLE public.quiz_questions ADD COLUMN quiz_id uuid REFERENCES public.quizzes (id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes (core) — skip quietly if a column is still missing
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS subjects_user_id_idx ON public.subjects (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS topics_user_id_idx ON public.topics (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS topics_subject_id_idx ON public.topics (subject_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS topics_parent_id_idx ON public.topics (parent_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS topics_needs_revision_idx ON public.topics (user_id, needs_revision) WHERE needs_revision = true');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_tasks_user_id_idx ON public.study_tasks (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_tasks_subject_id_idx ON public.study_tasks (subject_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_tasks_topic_id_idx ON public.study_tasks (topic_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_tasks_due_at_idx ON public.study_tasks (user_id, due_at)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_tasks_status_idx ON public.study_tasks (user_id, status)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_sessions_user_id_idx ON public.study_sessions (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_sessions_subject_id_idx ON public.study_sessions (subject_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS study_sessions_started_at_idx ON public.study_sessions (user_id, started_at DESC)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS notes_subject_id_idx ON public.notes (subject_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS notes_topic_id_idx ON public.notes (topic_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS notes_pinned_idx ON public.notes (user_id, pinned) WHERE pinned = true');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS learning_resources_user_id_idx ON public.learning_resources (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS learning_resources_note_id_idx ON public.learning_resources (note_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS learning_resources_subject_id_idx ON public.learning_resources (subject_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quizzes_user_id_idx ON public.quizzes (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quizzes_subject_id_idx ON public.quizzes (subject_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_questions_quiz_id_idx ON public.quiz_questions (quiz_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_questions_user_id_idx ON public.quiz_questions (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_id_idx ON public.quiz_attempts (quiz_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_attempts_user_id_idx ON public.quiz_attempts (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_answers_attempt_id_idx ON public.quiz_answers (attempt_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_answers_question_id_idx ON public.quiz_answers (question_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_answers_user_id_idx ON public.quiz_answers (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS flashcard_decks_user_id_idx ON public.flashcard_decks (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS flashcards_deck_id_idx ON public.flashcards (deck_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS flashcards_user_id_idx ON public.flashcards (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS flashcards_next_review_at_idx ON public.flashcards (user_id, next_review_at)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS flashcard_reviews_flashcard_id_idx ON public.flashcard_reviews (flashcard_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS flashcard_reviews_user_id_idx ON public.flashcard_reviews (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id, read) WHERE read = false');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS support_requests_user_id_idx ON public.support_requests (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS support_requests_status_idx ON public.support_requests (status)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx ON public.ai_conversations (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON public.ai_messages (conversation_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS ai_messages_user_id_idx ON public.ai_messages (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS ai_messages_user_created_idx ON public.ai_messages (user_id, created_at DESC)');

-- Triggers (core)
SELECT public.ss_ensure_trigger('profiles_set_updated_at', 'public.profiles');
SELECT public.ss_ensure_trigger('user_preferences_set_updated_at', 'public.user_preferences');
SELECT public.ss_ensure_trigger('subjects_set_updated_at', 'public.subjects');
SELECT public.ss_ensure_trigger('topics_set_updated_at', 'public.topics');
SELECT public.ss_ensure_trigger('study_tasks_set_updated_at', 'public.study_tasks');
SELECT public.ss_ensure_trigger('study_sessions_set_updated_at', 'public.study_sessions');
SELECT public.ss_ensure_trigger('notes_set_updated_at', 'public.notes');
SELECT public.ss_ensure_trigger('learning_resources_set_updated_at', 'public.learning_resources');
SELECT public.ss_ensure_trigger('quizzes_set_updated_at', 'public.quizzes');
SELECT public.ss_ensure_trigger('quiz_questions_set_updated_at', 'public.quiz_questions');
SELECT public.ss_ensure_trigger('quiz_attempts_set_updated_at', 'public.quiz_attempts');
SELECT public.ss_ensure_trigger('quiz_answers_set_updated_at', 'public.quiz_answers');
SELECT public.ss_ensure_trigger('flashcard_decks_set_updated_at', 'public.flashcard_decks');
SELECT public.ss_ensure_trigger('flashcards_set_updated_at', 'public.flashcards');
SELECT public.ss_ensure_trigger('flashcard_reviews_set_updated_at', 'public.flashcard_reviews');
SELECT public.ss_ensure_trigger('notifications_set_updated_at', 'public.notifications');
SELECT public.ss_ensure_trigger('support_requests_set_updated_at', 'public.support_requests');
SELECT public.ss_ensure_trigger('ai_conversations_set_updated_at', 'public.ai_conversations');
SELECT public.ss_ensure_trigger('ai_messages_set_updated_at', 'public.ai_messages');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- RLS enable
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Core policies (own-row)
SELECT public.ss_ensure_policy('profiles_select_own', 'public.profiles', 'SELECT', 'auth.uid() = id');
SELECT public.ss_ensure_policy('profiles_insert_own', 'public.profiles', 'INSERT', NULL, 'auth.uid() = id');
SELECT public.ss_ensure_policy('profiles_update_own', 'public.profiles', 'UPDATE', 'auth.uid() = id', 'auth.uid() = id');
SELECT public.ss_ensure_policy('profiles_delete_own', 'public.profiles', 'DELETE', 'auth.uid() = id');

SELECT public.ss_ensure_policy('user_preferences_select_own', 'public.user_preferences', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('user_preferences_insert_own', 'public.user_preferences', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('user_preferences_update_own', 'public.user_preferences', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('user_preferences_delete_own', 'public.user_preferences', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('subjects_select_own', 'public.subjects', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('subjects_insert_own', 'public.subjects', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('subjects_update_own', 'public.subjects', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('subjects_delete_own', 'public.subjects', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('topics_select_own', 'public.topics', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('topics_insert_own', 'public.topics', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('topics_update_own', 'public.topics', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('topics_delete_own', 'public.topics', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('study_tasks_select_own', 'public.study_tasks', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('study_tasks_insert_own', 'public.study_tasks', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('study_tasks_update_own', 'public.study_tasks', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('study_tasks_delete_own', 'public.study_tasks', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('study_sessions_select_own', 'public.study_sessions', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('study_sessions_insert_own', 'public.study_sessions', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('study_sessions_update_own', 'public.study_sessions', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('study_sessions_delete_own', 'public.study_sessions', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('notes_select_own', 'public.notes', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('notes_insert_own', 'public.notes', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('notes_update_own', 'public.notes', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('notes_delete_own', 'public.notes', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('learning_resources_select_own', 'public.learning_resources', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('learning_resources_insert_own', 'public.learning_resources', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('learning_resources_update_own', 'public.learning_resources', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('learning_resources_delete_own', 'public.learning_resources', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('quizzes_select_own', 'public.quizzes', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quizzes_insert_own', 'public.quizzes', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quizzes_update_own', 'public.quizzes', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quizzes_delete_own', 'public.quizzes', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('quiz_questions_select_own', 'public.quiz_questions', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_questions_insert_own', 'public.quiz_questions', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_questions_update_own', 'public.quiz_questions', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_questions_delete_own', 'public.quiz_questions', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('quiz_attempts_select_own', 'public.quiz_attempts', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_attempts_insert_own', 'public.quiz_attempts', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_attempts_update_own', 'public.quiz_attempts', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_attempts_delete_own', 'public.quiz_attempts', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('quiz_answers_select_own', 'public.quiz_answers', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_answers_insert_own', 'public.quiz_answers', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_answers_update_own', 'public.quiz_answers', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_answers_delete_own', 'public.quiz_answers', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('flashcard_decks_select_own', 'public.flashcard_decks', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcard_decks_insert_own', 'public.flashcard_decks', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcard_decks_update_own', 'public.flashcard_decks', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcard_decks_delete_own', 'public.flashcard_decks', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('flashcards_select_own', 'public.flashcards', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcards_insert_own', 'public.flashcards', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcards_update_own', 'public.flashcards', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcards_delete_own', 'public.flashcards', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('flashcard_reviews_select_own', 'public.flashcard_reviews', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcard_reviews_insert_own', 'public.flashcard_reviews', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcard_reviews_update_own', 'public.flashcard_reviews', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('flashcard_reviews_delete_own', 'public.flashcard_reviews', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('notifications_select_own', 'public.notifications', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('notifications_insert_own', 'public.notifications', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('notifications_update_own', 'public.notifications', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('notifications_delete_own', 'public.notifications', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('support_requests_select_own', 'public.support_requests', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('support_requests_insert', 'public.support_requests', 'INSERT', NULL, 'user_id IS NULL OR auth.uid() = user_id');
SELECT public.ss_ensure_policy('support_requests_update_own', 'public.support_requests', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('support_requests_admin_select', 'public.support_requests', 'SELECT', 'public.is_admin()');
SELECT public.ss_ensure_policy('support_requests_admin_update', 'public.support_requests', 'UPDATE', 'public.is_admin()', 'public.is_admin()');

SELECT public.ss_ensure_policy('ai_conversations_select_own', 'public.ai_conversations', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('ai_conversations_insert_own', 'public.ai_conversations', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('ai_conversations_update_own', 'public.ai_conversations', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('ai_conversations_delete_own', 'public.ai_conversations', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('ai_messages_select_own', 'public.ai_messages', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('ai_messages_insert_own', 'public.ai_messages', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('ai_messages_update_own', 'public.ai_messages', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('ai_messages_delete_own', 'public.ai_messages', 'DELETE', 'auth.uid() = user_id');

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('learning-resources', 'learning-resources', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (schemaname = storage)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'learning_resources_storage_select'
  ) THEN
    CREATE POLICY learning_resources_storage_select ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'learning-resources' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'learning_resources_storage_insert'
  ) THEN
    CREATE POLICY learning_resources_storage_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'learning-resources' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'learning_resources_storage_update'
  ) THEN
    CREATE POLICY learning_resources_storage_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'learning-resources' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'learning-resources' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'learning_resources_storage_delete'
  ) THEN
    CREATE POLICY learning_resources_storage_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'learning-resources' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Academic upgrade tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.education_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries (id) ON DELETE RESTRICT,
  name text NOT NULL,
  institution_type text NOT NULL CHECK (
    institution_type IN ('secondary', 'university', 'polytechnic', 'college_of_education', 'other')
  ),
  state_region text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (education_level_id, code)
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text
);

CREATE TABLE IF NOT EXISTS public.programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  starts_on date,
  ends_on date,
  is_current boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.catalogue_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  programme_id uuid REFERENCES public.programmes (id) ON DELETE SET NULL,
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE RESTRICT,
  class_level_id uuid REFERENCES public.class_levels (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  semester_term text CHECK (semester_term IS NULL OR semester_term IN ('first', 'second', 'third')),
  description text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_profile_complete boolean NOT NULL DEFAULT false;

SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS profiles_country_id_idx ON public.profiles (country_id)');

CREATE TABLE IF NOT EXISTS public.student_academic_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES public.countries (id) ON DELETE RESTRICT,
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE RESTRICT,
  programme_id uuid REFERENCES public.programmes (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  class_level_id uuid REFERENCES public.class_levels (id) ON DELETE SET NULL,
  academic_session_id uuid REFERENCES public.academic_sessions (id) ON DELETE SET NULL,
  semester_term text CHECK (semester_term IS NULL OR semester_term IN ('first', 'second', 'third')),
  course_of_study text,
  custom_institution_name text,
  custom_programme_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_course_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  catalogue_course_id uuid NOT NULL REFERENCES public.catalogue_courses (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, catalogue_course_id)
);

CREATE TABLE IF NOT EXISTS public.catalogue_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('institution', 'programme', 'course', 'material')),
  title text NOT NULL,
  details text,
  country_id uuid REFERENCES public.countries (id) ON DELETE SET NULL,
  education_level_id uuid REFERENCES public.education_levels (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_course_id uuid NOT NULL REFERENCES public.catalogue_courses (id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  title text NOT NULL,
  material_type text NOT NULL CHECK (
    material_type IN (
      'lecture_notes', 'study_guide', 'definitions', 'worked_examples',
      'practice', 'revision_summary', 'past_questions', 'other'
    )
  ),
  content_html text,
  file_path text,
  file_type text,
  file_size integer,
  extracted_text text,
  source_label text,
  is_ai_generated boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unpublished')),
  published_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_resources
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.learning_materials (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.material_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.learning_materials (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

CREATE TABLE IF NOT EXISTS public.material_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.learning_materials (id) ON DELETE CASCADE,
  selected_text text,
  note text NOT NULL,
  anchor_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.learning_materials (id) ON DELETE CASCADE,
  progress_percent numeric NOT NULL DEFAULT 0,
  last_position text,
  completed boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

CREATE TABLE IF NOT EXISTS public.question_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  education_level_id uuid REFERENCES public.education_levels (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.question_banks (id) ON DELETE CASCADE,
  topic_label text,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  prompt text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  explanation text,
  is_ai_generated boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES public.question_banks (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS pass_mark numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS question_count integer,
  ADD COLUMN IF NOT EXISTS is_timed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS randomized boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.learning_materials (id) ON DELETE SET NULL,
  quiz_id uuid REFERENCES public.quizzes (id) ON DELETE SET NULL,
  attempt_id uuid REFERENCES public.quiz_attempts (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  action_href text,
  reason text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'student_course_enrolments','catalogue_requests','material_bookmarks',
    'material_annotations','reading_progress','activity_events','student_recommendations',
    'topic_performance','quiz_question_usage','student_academic_profiles'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND NOT public.ss_has_column(t, 'user_id') THEN
      IF t = 'student_academic_profiles' THEN
        -- PK is user_id on this table; add if missing
        EXECUTE format(
          'ALTER TABLE public.%I ADD COLUMN user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE',
          t
        );
      ELSE
        EXECUTE format(
          'ALTER TABLE public.%I ADD COLUMN user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE',
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS institutions_country_id_idx ON public.institutions (country_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS institutions_type_idx ON public.institutions (institution_type)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS class_levels_education_level_id_idx ON public.class_levels (education_level_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS departments_institution_id_idx ON public.departments (institution_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS programmes_institution_id_idx ON public.programmes (institution_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS programmes_education_level_id_idx ON public.programmes (education_level_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS programmes_department_id_idx ON public.programmes (department_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS catalogue_courses_education_level_id_idx ON public.catalogue_courses (education_level_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS catalogue_courses_institution_id_idx ON public.catalogue_courses (institution_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS catalogue_courses_programme_id_idx ON public.catalogue_courses (programme_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS catalogue_courses_code_idx ON public.catalogue_courses (code)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS student_course_enrolments_user_id_idx ON public.student_course_enrolments (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS student_course_enrolments_catalogue_course_id_idx ON public.student_course_enrolments (catalogue_course_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS catalogue_requests_user_id_idx ON public.catalogue_requests (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS catalogue_requests_status_idx ON public.catalogue_requests (status)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS learning_materials_catalogue_course_id_idx ON public.learning_materials (catalogue_course_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS learning_materials_topic_id_idx ON public.learning_materials (topic_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS learning_materials_status_idx ON public.learning_materials (status)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS learning_resources_material_id_idx ON public.learning_resources (material_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS material_bookmarks_user_id_idx ON public.material_bookmarks (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS material_annotations_user_id_idx ON public.material_annotations (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS material_annotations_material_id_idx ON public.material_annotations (material_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS reading_progress_user_id_idx ON public.reading_progress (user_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS question_banks_catalogue_course_id_idx ON public.question_banks (catalogue_course_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS question_banks_education_level_id_idx ON public.question_banks (education_level_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS bank_questions_bank_id_idx ON public.bank_questions (bank_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quizzes_catalogue_course_id_idx ON public.quizzes (catalogue_course_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quizzes_bank_id_idx ON public.quizzes (bank_id)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS activity_events_user_id_created_at_idx ON public.activity_events (user_id, created_at DESC)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS activity_events_user_id_event_type_idx ON public.activity_events (user_id, event_type)');
SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS student_recommendations_user_id_idx ON public.student_recommendations (user_id)');

SELECT public.ss_ensure_trigger('institutions_set_updated_at', 'public.institutions');
SELECT public.ss_ensure_trigger('catalogue_courses_set_updated_at', 'public.catalogue_courses');
SELECT public.ss_ensure_trigger('student_academic_profiles_set_updated_at', 'public.student_academic_profiles');
SELECT public.ss_ensure_trigger('catalogue_requests_set_updated_at', 'public.catalogue_requests');
SELECT public.ss_ensure_trigger('learning_materials_set_updated_at', 'public.learning_materials');
SELECT public.ss_ensure_trigger('material_annotations_set_updated_at', 'public.material_annotations');
SELECT public.ss_ensure_trigger('question_banks_set_updated_at', 'public.question_banks');
SELECT public.ss_ensure_trigger('platform_settings_set_updated_at', 'public.platform_settings');

INSERT INTO public.platform_settings (key, value)
VALUES ('default_pass_mark', '50'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_academic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_course_enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

SELECT public.ss_ensure_policy('countries_select_authenticated', 'public.countries', 'SELECT', 'true');
SELECT public.ss_ensure_policy('education_levels_select_authenticated', 'public.education_levels', 'SELECT', 'true');
SELECT public.ss_ensure_policy('institutions_select_authenticated', 'public.institutions', 'SELECT', 'true');
SELECT public.ss_ensure_policy('class_levels_select_authenticated', 'public.class_levels', 'SELECT', 'true');
SELECT public.ss_ensure_policy('departments_select_authenticated', 'public.departments', 'SELECT', 'true');
SELECT public.ss_ensure_policy('programmes_select_authenticated', 'public.programmes', 'SELECT', 'true');
SELECT public.ss_ensure_policy('academic_sessions_select_authenticated', 'public.academic_sessions', 'SELECT', 'true');
SELECT public.ss_ensure_policy('catalogue_courses_select_published', 'public.catalogue_courses', 'SELECT', 'is_published = true OR public.is_admin()');
SELECT public.ss_ensure_policy('question_banks_select_published', 'public.question_banks', 'SELECT', 'is_published = true OR public.is_admin()');
SELECT public.ss_ensure_policy('bank_questions_select_published', 'public.bank_questions', 'SELECT', 'EXISTS (SELECT 1 FROM public.question_banks b WHERE b.id = bank_id AND (b.is_published OR public.is_admin()))');
SELECT public.ss_ensure_policy('learning_materials_select_published', 'public.learning_materials', 'SELECT', 'status = ''published'' OR public.is_admin() OR created_by = auth.uid()');
SELECT public.ss_ensure_policy('platform_settings_select_authenticated', 'public.platform_settings', 'SELECT', 'true');

SELECT public.ss_ensure_policy('student_academic_profiles_select_own', 'public.student_academic_profiles', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_academic_profiles_insert_own', 'public.student_academic_profiles', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_academic_profiles_update_own', 'public.student_academic_profiles', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_academic_profiles_delete_own', 'public.student_academic_profiles', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('student_course_enrolments_select_own', 'public.student_course_enrolments', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_course_enrolments_insert_own', 'public.student_course_enrolments', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_course_enrolments_update_own', 'public.student_course_enrolments', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_course_enrolments_delete_own', 'public.student_course_enrolments', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('catalogue_requests_select_own', 'public.catalogue_requests', 'SELECT', 'auth.uid() = user_id OR public.is_admin()');
SELECT public.ss_ensure_policy('catalogue_requests_insert_own', 'public.catalogue_requests', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('catalogue_requests_update_own', 'public.catalogue_requests', 'UPDATE', 'auth.uid() = user_id OR public.is_admin()', 'auth.uid() = user_id OR public.is_admin()');

SELECT public.ss_ensure_policy('material_bookmarks_select_own', 'public.material_bookmarks', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('material_bookmarks_insert_own', 'public.material_bookmarks', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('material_bookmarks_delete_own', 'public.material_bookmarks', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('material_annotations_select_own', 'public.material_annotations', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('material_annotations_insert_own', 'public.material_annotations', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('material_annotations_update_own', 'public.material_annotations', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('material_annotations_delete_own', 'public.material_annotations', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('reading_progress_select_own', 'public.reading_progress', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('reading_progress_insert_own', 'public.reading_progress', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('reading_progress_update_own', 'public.reading_progress', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('reading_progress_delete_own', 'public.reading_progress', 'DELETE', 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('activity_events_select_own', 'public.activity_events', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('activity_events_insert_own', 'public.activity_events', 'INSERT', NULL, 'auth.uid() = user_id');

SELECT public.ss_ensure_policy('student_recommendations_select_own', 'public.student_recommendations', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_recommendations_insert_own', 'public.student_recommendations', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_recommendations_update_own', 'public.student_recommendations', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('student_recommendations_delete_own', 'public.student_recommendations', 'DELETE', 'auth.uid() = user_id');

-- Admin write helpers for catalogue (minimal)
SELECT public.ss_ensure_policy('countries_admin_all', 'public.countries', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('institutions_admin_all', 'public.institutions', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('education_levels_admin_all', 'public.education_levels', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('class_levels_admin_all', 'public.class_levels', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('departments_admin_all', 'public.departments', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('programmes_admin_all', 'public.programmes', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('academic_sessions_admin_all', 'public.academic_sessions', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('catalogue_courses_admin_all', 'public.catalogue_courses', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('learning_materials_admin_all', 'public.learning_materials', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('question_banks_admin_all', 'public.question_banks', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('bank_questions_admin_all', 'public.bank_questions', 'ALL', 'public.is_admin()', 'public.is_admin()');
SELECT public.ss_ensure_policy('platform_settings_admin_all', 'public.platform_settings', 'ALL', 'public.is_admin()', 'public.is_admin()');

-- ---------------------------------------------------------------------------
-- V2 learning / exam
-- ---------------------------------------------------------------------------
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS topic_label text,
  ADD COLUMN IF NOT EXISTS bank_question_id uuid REFERENCES public.bank_questions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_fingerprint text;

SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_questions_topic_label_idx ON public.quiz_questions (user_id, topic_label)');

ALTER TABLE public.student_recommendations
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS student_recommendations_user_kind_idx ON public.student_recommendations (user_id, kind) WHERE dismissed = false');

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

SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS topic_performance_user_idx ON public.topic_performance (user_id, incorrect_count DESC)');

ALTER TABLE public.topic_performance ENABLE ROW LEVEL SECURITY;
SELECT public.ss_ensure_trigger('topic_performance_set_updated_at', 'public.topic_performance');
SELECT public.ss_ensure_policy('topic_performance_select_own', 'public.topic_performance', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('topic_performance_insert_own', 'public.topic_performance', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('topic_performance_update_own', 'public.topic_performance', 'UPDATE', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('topic_performance_delete_own', 'public.topic_performance', 'DELETE', 'auth.uid() = user_id');

CREATE TABLE IF NOT EXISTS public.quiz_question_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  bank_question_id uuid REFERENCES public.bank_questions (id) ON DELETE CASCADE,
  source_fingerprint text,
  attempt_id uuid REFERENCES public.quiz_attempts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.ss_safe_sql('CREATE INDEX IF NOT EXISTS quiz_question_usage_user_course_idx ON public.quiz_question_usage (user_id, catalogue_course_id, created_at DESC)');

ALTER TABLE public.quiz_question_usage ENABLE ROW LEVEL SECURITY;
SELECT public.ss_ensure_policy('quiz_question_usage_select_own', 'public.quiz_question_usage', 'SELECT', 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_question_usage_insert_own', 'public.quiz_question_usage', 'INSERT', NULL, 'auth.uid() = user_id');
SELECT public.ss_ensure_policy('quiz_question_usage_delete_own', 'public.quiz_question_usage', 'DELETE', 'auth.uid() = user_id');

INSERT INTO public.platform_settings (key, value)
VALUES
  ('learning_min_incorrect', '2'::jsonb),
  ('learning_min_attempts', '2'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Final sanity check
DO $$
BEGIN
  IF to_regclass('public.quiz_questions') IS NULL
     OR to_regclass('public.bank_questions') IS NULL
     OR to_regclass('public.topic_performance') IS NULL THEN
    RAISE EXCEPTION 'Repair incomplete — unexpected missing tables';
  END IF;
  RAISE NOTICE 'StudySphere schema repair completed successfully.';
END $$;
