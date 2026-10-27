-- StudySphere initial schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
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

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin check helper (for RLS)
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

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_preferences (
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

CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user: profile + preferences
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
  );
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  icon text,
  goal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subjects_user_id_idx ON public.subjects (user_id);

CREATE TRIGGER subjects_set_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
CREATE TABLE public.topics (
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

CREATE INDEX topics_user_id_idx ON public.topics (user_id);
CREATE INDEX topics_subject_id_idx ON public.topics (subject_id);
CREATE INDEX topics_parent_id_idx ON public.topics (parent_id);
CREATE INDEX topics_needs_revision_idx ON public.topics (user_id, needs_revision) WHERE needs_revision = true;

CREATE TRIGGER topics_set_updated_at
  BEFORE UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- study_tasks
-- ---------------------------------------------------------------------------
CREATE TABLE public.study_tasks (
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

CREATE INDEX study_tasks_user_id_idx ON public.study_tasks (user_id);
CREATE INDEX study_tasks_subject_id_idx ON public.study_tasks (subject_id);
CREATE INDEX study_tasks_topic_id_idx ON public.study_tasks (topic_id);
CREATE INDEX study_tasks_due_at_idx ON public.study_tasks (user_id, due_at);
CREATE INDEX study_tasks_status_idx ON public.study_tasks (user_id, status);

CREATE TRIGGER study_tasks_set_updated_at
  BEFORE UPDATE ON public.study_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- study_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE public.study_sessions (
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

CREATE INDEX study_sessions_user_id_idx ON public.study_sessions (user_id);
CREATE INDEX study_sessions_subject_id_idx ON public.study_sessions (subject_id);
CREATE INDEX study_sessions_started_at_idx ON public.study_sessions (user_id, started_at DESC);

CREATE TRIGGER study_sessions_set_updated_at
  BEFORE UPDATE ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
CREATE TABLE public.notes (
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

CREATE INDEX notes_user_id_idx ON public.notes (user_id);
CREATE INDEX notes_subject_id_idx ON public.notes (subject_id);
CREATE INDEX notes_topic_id_idx ON public.notes (topic_id);
CREATE INDEX notes_pinned_idx ON public.notes (user_id, pinned) WHERE pinned = true;

CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- learning_resources
-- ---------------------------------------------------------------------------
CREATE TABLE public.learning_resources (
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

CREATE INDEX learning_resources_user_id_idx ON public.learning_resources (user_id);
CREATE INDEX learning_resources_note_id_idx ON public.learning_resources (note_id);
CREATE INDEX learning_resources_subject_id_idx ON public.learning_resources (subject_id);

CREATE TRIGGER learning_resources_set_updated_at
  BEFORE UPDATE ON public.learning_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quizzes
-- ---------------------------------------------------------------------------
CREATE TABLE public.quizzes (
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

CREATE INDEX quizzes_user_id_idx ON public.quizzes (user_id);
CREATE INDEX quizzes_subject_id_idx ON public.quizzes (subject_id);

CREATE TRIGGER quizzes_set_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quiz_questions
-- ---------------------------------------------------------------------------
CREATE TABLE public.quiz_questions (
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

CREATE INDEX quiz_questions_quiz_id_idx ON public.quiz_questions (quiz_id);
CREATE INDEX quiz_questions_user_id_idx ON public.quiz_questions (user_id);

CREATE TRIGGER quiz_questions_set_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quiz_attempts
-- ---------------------------------------------------------------------------
CREATE TABLE public.quiz_attempts (
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

CREATE INDEX quiz_attempts_quiz_id_idx ON public.quiz_attempts (quiz_id);
CREATE INDEX quiz_attempts_user_id_idx ON public.quiz_attempts (user_id);

CREATE TRIGGER quiz_attempts_set_updated_at
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quiz_answers
-- ---------------------------------------------------------------------------
CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  answer text,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quiz_answers_attempt_id_idx ON public.quiz_answers (attempt_id);
CREATE INDEX quiz_answers_question_id_idx ON public.quiz_answers (question_id);
CREATE INDEX quiz_answers_user_id_idx ON public.quiz_answers (user_id);

CREATE TRIGGER quiz_answers_set_updated_at
  BEFORE UPDATE ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- flashcard_decks
-- ---------------------------------------------------------------------------
CREATE TABLE public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flashcard_decks_user_id_idx ON public.flashcard_decks (user_id);

CREATE TRIGGER flashcard_decks_set_updated_at
  BEFORE UPDATE ON public.flashcard_decks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------------------
CREATE TABLE public.flashcards (
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

CREATE INDEX flashcards_deck_id_idx ON public.flashcards (deck_id);
CREATE INDEX flashcards_user_id_idx ON public.flashcards (user_id);
CREATE INDEX flashcards_next_review_at_idx ON public.flashcards (user_id, next_review_at);

CREATE TRIGGER flashcards_set_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- flashcard_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE public.flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id uuid NOT NULL REFERENCES public.flashcards (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  quality integer NOT NULL CHECK (quality >= 0 AND quality <= 5),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flashcard_reviews_flashcard_id_idx ON public.flashcard_reviews (flashcard_id);
CREATE INDEX flashcard_reviews_user_id_idx ON public.flashcard_reviews (user_id);

CREATE TRIGGER flashcard_reviews_set_updated_at
  BEFORE UPDATE ON public.flashcard_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
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

CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_unread_idx ON public.notifications (user_id, read) WHERE read = false;

CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- support_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_requests_user_id_idx ON public.support_requests (user_id);
CREATE INDEX support_requests_status_idx ON public.support_requests (status);

CREATE TRIGGER support_requests_set_updated_at
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_conversations_user_id_idx ON public.ai_conversations (user_id);

CREATE TRIGGER ai_conversations_set_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_messages_conversation_id_idx ON public.ai_messages (conversation_id);
CREATE INDEX ai_messages_user_id_idx ON public.ai_messages (user_id);
CREATE INDEX ai_messages_user_created_idx ON public.ai_messages (user_id, created_at DESC);

CREATE TRIGGER ai_messages_set_updated_at
  BEFORE UPDATE ON public.ai_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auth trigger (after tables exist)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
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

-- profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_delete_own ON public.profiles FOR DELETE USING (auth.uid() = id);

-- user_preferences
CREATE POLICY user_preferences_select_own ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_preferences_insert_own ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_preferences_update_own ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_preferences_delete_own ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

-- subjects
CREATE POLICY subjects_select_own ON public.subjects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY subjects_insert_own ON public.subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY subjects_update_own ON public.subjects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY subjects_delete_own ON public.subjects FOR DELETE USING (auth.uid() = user_id);

-- topics
CREATE POLICY topics_select_own ON public.topics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY topics_insert_own ON public.topics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY topics_update_own ON public.topics FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY topics_delete_own ON public.topics FOR DELETE USING (auth.uid() = user_id);

-- study_tasks
CREATE POLICY study_tasks_select_own ON public.study_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY study_tasks_insert_own ON public.study_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_tasks_update_own ON public.study_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_tasks_delete_own ON public.study_tasks FOR DELETE USING (auth.uid() = user_id);

-- study_sessions
CREATE POLICY study_sessions_select_own ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY study_sessions_insert_own ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_sessions_update_own ON public.study_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_sessions_delete_own ON public.study_sessions FOR DELETE USING (auth.uid() = user_id);

-- notes
CREATE POLICY notes_select_own ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notes_insert_own ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY notes_update_own ON public.notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notes_delete_own ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- learning_resources
CREATE POLICY learning_resources_select_own ON public.learning_resources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY learning_resources_insert_own ON public.learning_resources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY learning_resources_update_own ON public.learning_resources FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY learning_resources_delete_own ON public.learning_resources FOR DELETE USING (auth.uid() = user_id);

-- quizzes
CREATE POLICY quizzes_select_own ON public.quizzes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY quizzes_insert_own ON public.quizzes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY quizzes_update_own ON public.quizzes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY quizzes_delete_own ON public.quizzes FOR DELETE USING (auth.uid() = user_id);

-- quiz_questions
CREATE POLICY quiz_questions_select_own ON public.quiz_questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY quiz_questions_insert_own ON public.quiz_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY quiz_questions_update_own ON public.quiz_questions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY quiz_questions_delete_own ON public.quiz_questions FOR DELETE USING (auth.uid() = user_id);

-- quiz_attempts
CREATE POLICY quiz_attempts_select_own ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY quiz_attempts_insert_own ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY quiz_attempts_update_own ON public.quiz_attempts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY quiz_attempts_delete_own ON public.quiz_attempts FOR DELETE USING (auth.uid() = user_id);

-- quiz_answers
CREATE POLICY quiz_answers_select_own ON public.quiz_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY quiz_answers_insert_own ON public.quiz_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY quiz_answers_update_own ON public.quiz_answers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY quiz_answers_delete_own ON public.quiz_answers FOR DELETE USING (auth.uid() = user_id);

-- flashcard_decks
CREATE POLICY flashcard_decks_select_own ON public.flashcard_decks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY flashcard_decks_insert_own ON public.flashcard_decks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcard_decks_update_own ON public.flashcard_decks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcard_decks_delete_own ON public.flashcard_decks FOR DELETE USING (auth.uid() = user_id);

-- flashcards
CREATE POLICY flashcards_select_own ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY flashcards_insert_own ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcards_update_own ON public.flashcards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcards_delete_own ON public.flashcards FOR DELETE USING (auth.uid() = user_id);

-- flashcard_reviews
CREATE POLICY flashcard_reviews_select_own ON public.flashcard_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY flashcard_reviews_insert_own ON public.flashcard_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcard_reviews_update_own ON public.flashcard_reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY flashcard_reviews_delete_own ON public.flashcard_reviews FOR DELETE USING (auth.uid() = user_id);

-- notifications
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_insert_own ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- support_requests: users see own; anyone authenticated can insert (contact form)
CREATE POLICY support_requests_select_own ON public.support_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY support_requests_insert ON public.support_requests FOR INSERT WITH CHECK (
  user_id IS NULL OR auth.uid() = user_id
);
CREATE POLICY support_requests_update_own ON public.support_requests FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY support_requests_admin_select ON public.support_requests FOR SELECT USING (public.is_admin());
CREATE POLICY support_requests_admin_update ON public.support_requests FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ai_conversations
CREATE POLICY ai_conversations_select_own ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ai_conversations_insert_own ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_conversations_update_own ON public.ai_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_conversations_delete_own ON public.ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- ai_messages
CREATE POLICY ai_messages_select_own ON public.ai_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ai_messages_insert_own ON public.ai_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_messages_update_own ON public.ai_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_messages_delete_own ON public.ai_messages FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: learning-resources bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'learning-resources',
  'learning-resources',
  false,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY learning_resources_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY learning_resources_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY learning_resources_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY learning_resources_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
