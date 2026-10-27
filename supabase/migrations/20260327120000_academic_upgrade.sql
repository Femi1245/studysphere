-- StudySphere academic catalogue upgrade (Nigeria-first)

-- ---------------------------------------------------------------------------
-- countries
-- ---------------------------------------------------------------------------
CREATE TABLE public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- education_levels
-- ---------------------------------------------------------------------------
CREATE TABLE public.education_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------------
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries (id) ON DELETE RESTRICT,
  name text NOT NULL,
  institution_type text NOT NULL CHECK (
    institution_type IN (
      'secondary',
      'university',
      'polytechnic',
      'college_of_education',
      'other'
    )
  ),
  state_region text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX institutions_country_id_idx ON public.institutions (country_id);
CREATE INDEX institutions_type_idx ON public.institutions (institution_type);

CREATE TRIGGER institutions_set_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- class_levels
-- ---------------------------------------------------------------------------
CREATE TABLE public.class_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (education_level_id, code)
);

CREATE INDEX class_levels_education_level_id_idx ON public.class_levels (education_level_id);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text
);

CREATE INDEX departments_institution_id_idx ON public.departments (institution_id);

-- ---------------------------------------------------------------------------
-- programmes
-- ---------------------------------------------------------------------------
CREATE TABLE public.programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX programmes_institution_id_idx ON public.programmes (institution_id);
CREATE INDEX programmes_education_level_id_idx ON public.programmes (education_level_id);
CREATE INDEX programmes_department_id_idx ON public.programmes (department_id);

-- ---------------------------------------------------------------------------
-- academic_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE public.academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  starts_on date,
  ends_on date,
  is_current boolean NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- catalogue_courses
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalogue_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  programme_id uuid REFERENCES public.programmes (id) ON DELETE SET NULL,
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE RESTRICT,
  class_level_id uuid REFERENCES public.class_levels (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  semester_term text CHECK (
    semester_term IS NULL OR semester_term IN ('first', 'second', 'third')
  ),
  description text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX catalogue_courses_education_level_id_idx ON public.catalogue_courses (education_level_id);
CREATE INDEX catalogue_courses_institution_id_idx ON public.catalogue_courses (institution_id);
CREATE INDEX catalogue_courses_programme_id_idx ON public.catalogue_courses (programme_id);
CREATE INDEX catalogue_courses_code_idx ON public.catalogue_courses (code);

CREATE TRIGGER catalogue_courses_set_updated_at
  BEFORE UPDATE ON public.catalogue_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN country_id uuid REFERENCES public.countries (id) ON DELETE SET NULL,
  ADD COLUMN academic_profile_complete boolean NOT NULL DEFAULT false;

CREATE INDEX profiles_country_id_idx ON public.profiles (country_id);

-- ---------------------------------------------------------------------------
-- student_academic_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_academic_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES public.countries (id) ON DELETE RESTRICT,
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  education_level_id uuid NOT NULL REFERENCES public.education_levels (id) ON DELETE RESTRICT,
  programme_id uuid REFERENCES public.programmes (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  class_level_id uuid REFERENCES public.class_levels (id) ON DELETE SET NULL,
  academic_session_id uuid REFERENCES public.academic_sessions (id) ON DELETE SET NULL,
  semester_term text CHECK (
    semester_term IS NULL OR semester_term IN ('first', 'second', 'third')
  ),
  course_of_study text,
  custom_institution_name text,
  custom_programme_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER student_academic_profiles_set_updated_at
  BEFORE UPDATE ON public.student_academic_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- student_course_enrolments
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_course_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  catalogue_course_id uuid NOT NULL REFERENCES public.catalogue_courses (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, catalogue_course_id)
);

CREATE INDEX student_course_enrolments_user_id_idx ON public.student_course_enrolments (user_id);
CREATE INDEX student_course_enrolments_catalogue_course_id_idx ON public.student_course_enrolments (catalogue_course_id);

-- ---------------------------------------------------------------------------
-- catalogue_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalogue_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (
    request_type IN ('institution', 'programme', 'course', 'material')
  ),
  title text NOT NULL,
  details text,
  country_id uuid REFERENCES public.countries (id) ON DELETE SET NULL,
  education_level_id uuid REFERENCES public.education_levels (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX catalogue_requests_user_id_idx ON public.catalogue_requests (user_id);
CREATE INDEX catalogue_requests_status_idx ON public.catalogue_requests (status);

CREATE TRIGGER catalogue_requests_set_updated_at
  BEFORE UPDATE ON public.catalogue_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- learning_materials
-- ---------------------------------------------------------------------------
CREATE TABLE public.learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_course_id uuid NOT NULL REFERENCES public.catalogue_courses (id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics (id) ON DELETE SET NULL,
  title text NOT NULL,
  material_type text NOT NULL CHECK (
    material_type IN (
      'lecture_notes',
      'study_guide',
      'definitions',
      'worked_examples',
      'practice',
      'revision_summary',
      'past_questions',
      'other'
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

CREATE INDEX learning_materials_catalogue_course_id_idx ON public.learning_materials (catalogue_course_id);
CREATE INDEX learning_materials_topic_id_idx ON public.learning_materials (topic_id);
CREATE INDEX learning_materials_status_idx ON public.learning_materials (status);

CREATE TRIGGER learning_materials_set_updated_at
  BEFORE UPDATE ON public.learning_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- learning_resources extension
-- ---------------------------------------------------------------------------
ALTER TABLE public.learning_resources
  ADD COLUMN material_id uuid REFERENCES public.learning_materials (id) ON DELETE SET NULL;

CREATE INDEX learning_resources_material_id_idx ON public.learning_resources (material_id);

-- ---------------------------------------------------------------------------
-- material_bookmarks
-- ---------------------------------------------------------------------------
CREATE TABLE public.material_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.learning_materials (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

CREATE INDEX material_bookmarks_user_id_idx ON public.material_bookmarks (user_id);

-- ---------------------------------------------------------------------------
-- material_annotations
-- ---------------------------------------------------------------------------
CREATE TABLE public.material_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.learning_materials (id) ON DELETE CASCADE,
  selected_text text,
  note text NOT NULL,
  anchor_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX material_annotations_user_id_idx ON public.material_annotations (user_id);
CREATE INDEX material_annotations_material_id_idx ON public.material_annotations (material_id);

CREATE TRIGGER material_annotations_set_updated_at
  BEFORE UPDATE ON public.material_annotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reading_progress
-- ---------------------------------------------------------------------------
CREATE TABLE public.reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.learning_materials (id) ON DELETE CASCADE,
  progress_percent numeric NOT NULL DEFAULT 0,
  last_position text,
  completed boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

CREATE INDEX reading_progress_user_id_idx ON public.reading_progress (user_id);

-- ---------------------------------------------------------------------------
-- question_banks
-- ---------------------------------------------------------------------------
CREATE TABLE public.question_banks (
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

CREATE INDEX question_banks_catalogue_course_id_idx ON public.question_banks (catalogue_course_id);
CREATE INDEX question_banks_education_level_id_idx ON public.question_banks (education_level_id);

CREATE TRIGGER question_banks_set_updated_at
  BEFORE UPDATE ON public.question_banks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bank_questions
-- ---------------------------------------------------------------------------
CREATE TABLE public.bank_questions (
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

CREATE INDEX bank_questions_bank_id_idx ON public.bank_questions (bank_id);

-- ---------------------------------------------------------------------------
-- quizzes extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.quizzes
  ADD COLUMN catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  ADD COLUMN bank_id uuid REFERENCES public.question_banks (id) ON DELETE SET NULL,
  ADD COLUMN difficulty text,
  ADD COLUMN pass_mark numeric NOT NULL DEFAULT 50,
  ADD COLUMN mode text NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'assessment')),
  ADD COLUMN question_count integer,
  ADD COLUMN is_timed boolean NOT NULL DEFAULT false,
  ADD COLUMN randomized boolean NOT NULL DEFAULT true;

CREATE INDEX quizzes_catalogue_course_id_idx ON public.quizzes (catalogue_course_id);
CREATE INDEX quizzes_bank_id_idx ON public.quizzes (bank_id);

-- ---------------------------------------------------------------------------
-- activity_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.activity_events (
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

CREATE INDEX activity_events_user_id_created_at_idx ON public.activity_events (user_id, created_at DESC);
CREATE INDEX activity_events_user_id_event_type_idx ON public.activity_events (user_id, event_type);

-- ---------------------------------------------------------------------------
-- student_recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  action_href text,
  reason text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX student_recommendations_user_id_idx ON public.student_recommendations (user_id);

-- ---------------------------------------------------------------------------
-- platform_settings
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER platform_settings_set_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value)
VALUES ('default_pass_mark', '50'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
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

-- Catalogue reference data: authenticated read
CREATE POLICY countries_select_authenticated ON public.countries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY institutions_select_authenticated ON public.institutions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY education_levels_select_authenticated ON public.education_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY class_levels_select_authenticated ON public.class_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_select_authenticated ON public.departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY programmes_select_authenticated ON public.programmes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY academic_sessions_select_authenticated ON public.academic_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY catalogue_courses_select_authenticated ON public.catalogue_courses
  FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin());

CREATE POLICY question_banks_select_authenticated ON public.question_banks
  FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin());

CREATE POLICY bank_questions_select_authenticated ON public.bank_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_banks qb
      WHERE qb.id = bank_id AND (qb.is_published = true OR public.is_admin())
    )
  );

CREATE POLICY learning_materials_select_authenticated ON public.learning_materials
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_admin());

CREATE POLICY platform_settings_select_authenticated ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

-- Admin: catalogue + materials + banks + platform_settings
CREATE POLICY countries_admin_all ON public.countries
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY institutions_admin_all ON public.institutions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY education_levels_admin_all ON public.education_levels
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY class_levels_admin_all ON public.class_levels
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY departments_admin_all ON public.departments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY programmes_admin_all ON public.programmes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY academic_sessions_admin_all ON public.academic_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY catalogue_courses_admin_all ON public.catalogue_courses
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY learning_materials_admin_all ON public.learning_materials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY question_banks_admin_all ON public.question_banks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY bank_questions_admin_all ON public.bank_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY platform_settings_admin_all ON public.platform_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Student academic profile
CREATE POLICY student_academic_profiles_select_own ON public.student_academic_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY student_academic_profiles_insert_own ON public.student_academic_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY student_academic_profiles_update_own ON public.student_academic_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY student_academic_profiles_delete_own ON public.student_academic_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Enrolments
CREATE POLICY student_course_enrolments_select_own ON public.student_course_enrolments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY student_course_enrolments_insert_own ON public.student_course_enrolments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY student_course_enrolments_update_own ON public.student_course_enrolments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY student_course_enrolments_delete_own ON public.student_course_enrolments
  FOR DELETE USING (auth.uid() = user_id);

-- Catalogue requests (owner + admin update)
CREATE POLICY catalogue_requests_select_own ON public.catalogue_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY catalogue_requests_insert_own ON public.catalogue_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY catalogue_requests_update_own ON public.catalogue_requests
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY catalogue_requests_delete_own ON public.catalogue_requests
  FOR DELETE USING (auth.uid() = user_id);

-- Material bookmarks
CREATE POLICY material_bookmarks_select_own ON public.material_bookmarks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY material_bookmarks_insert_own ON public.material_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY material_bookmarks_update_own ON public.material_bookmarks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY material_bookmarks_delete_own ON public.material_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Material annotations
CREATE POLICY material_annotations_select_own ON public.material_annotations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY material_annotations_insert_own ON public.material_annotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY material_annotations_update_own ON public.material_annotations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY material_annotations_delete_own ON public.material_annotations
  FOR DELETE USING (auth.uid() = user_id);

-- Reading progress
CREATE POLICY reading_progress_select_own ON public.reading_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY reading_progress_insert_own ON public.reading_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY reading_progress_update_own ON public.reading_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY reading_progress_delete_own ON public.reading_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Activity events
CREATE POLICY activity_events_select_own ON public.activity_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY activity_events_insert_own ON public.activity_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY activity_events_update_own ON public.activity_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY activity_events_delete_own ON public.activity_events
  FOR DELETE USING (auth.uid() = user_id);

-- Recommendations
CREATE POLICY student_recommendations_select_own ON public.student_recommendations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY student_recommendations_insert_own ON public.student_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY student_recommendations_update_own ON public.student_recommendations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY student_recommendations_delete_own ON public.student_recommendations
  FOR DELETE USING (auth.uid() = user_id);
