-- Curriculum subjects + theory/practical study books with student progress tracking
-- Self-contained: does not require ss_ensure_trigger / ss_ensure_policy helpers.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

CREATE TABLE IF NOT EXISTS public.curriculum_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid REFERENCES public.programmes (id) ON DELETE CASCADE,
  education_level_id uuid REFERENCES public.education_levels (id) ON DELETE SET NULL,
  catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recommended_study_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_course_id uuid REFERENCES public.catalogue_courses (id) ON DELETE CASCADE,
  programme_id uuid REFERENCES public.programmes (id) ON DELETE SET NULL,
  curriculum_subject_id uuid REFERENCES public.curriculum_subjects (id) ON DELETE SET NULL,
  subject_label text NOT NULL,
  title text NOT NULL,
  author text,
  edition text,
  book_kind text NOT NULL CHECK (book_kind IN ('theory', 'practical')),
  description text,
  is_published boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.recommended_study_books (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent integer NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  last_studied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS curriculum_subjects_programme_id_idx
  ON public.curriculum_subjects (programme_id);
CREATE INDEX IF NOT EXISTS curriculum_subjects_course_id_idx
  ON public.curriculum_subjects (catalogue_course_id);
CREATE INDEX IF NOT EXISTS recommended_study_books_course_id_idx
  ON public.recommended_study_books (catalogue_course_id);
CREATE INDEX IF NOT EXISTS recommended_study_books_programme_id_idx
  ON public.recommended_study_books (programme_id);
CREATE INDEX IF NOT EXISTS student_book_progress_user_id_idx
  ON public.student_book_progress (user_id);

DROP TRIGGER IF EXISTS curriculum_subjects_set_updated_at ON public.curriculum_subjects;
CREATE TRIGGER curriculum_subjects_set_updated_at
  BEFORE UPDATE ON public.curriculum_subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS recommended_study_books_set_updated_at ON public.recommended_study_books;
CREATE TRIGGER recommended_study_books_set_updated_at
  BEFORE UPDATE ON public.recommended_study_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS student_book_progress_set_updated_at ON public.student_book_progress;
CREATE TRIGGER student_book_progress_set_updated_at
  BEFORE UPDATE ON public.student_book_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommended_study_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_book_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curriculum_subjects_select_published ON public.curriculum_subjects;
CREATE POLICY curriculum_subjects_select_published
  ON public.curriculum_subjects FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS curriculum_subjects_admin_all ON public.curriculum_subjects;
CREATE POLICY curriculum_subjects_admin_all
  ON public.curriculum_subjects FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS recommended_study_books_select_published ON public.recommended_study_books;
CREATE POLICY recommended_study_books_select_published
  ON public.recommended_study_books FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS recommended_study_books_admin_all ON public.recommended_study_books;
CREATE POLICY recommended_study_books_admin_all
  ON public.recommended_study_books FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS student_book_progress_select_own ON public.student_book_progress;
CREATE POLICY student_book_progress_select_own
  ON public.student_book_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS student_book_progress_insert_own ON public.student_book_progress;
CREATE POLICY student_book_progress_insert_own
  ON public.student_book_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS student_book_progress_update_own ON public.student_book_progress;
CREATE POLICY student_book_progress_update_own
  ON public.student_book_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS student_book_progress_delete_own ON public.student_book_progress;
CREATE POLICY student_book_progress_delete_own
  ON public.student_book_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Curriculum subjects for shared programmes
INSERT INTO public.curriculum_subjects (
  id, programme_id, education_level_id, catalogue_course_id, name, code, description, order_index
) VALUES
  ('b1000001-0000-4000-8000-000000000001', 'a1000310-0000-4000-8000-000000000310', 'a1000012-0000-4000-8000-000000000012', 'a1000601-0000-4000-8000-000000000601', 'Introduction to Computer Science', 'CSC101', 'Foundations of computing.', 1),
  ('b1000002-0000-4000-8000-000000000002', 'a1000310-0000-4000-8000-000000000310', 'a1000012-0000-4000-8000-000000000012', 'a1000602-0000-4000-8000-000000000602', 'Programming Fundamentals', 'CSC102', 'Introductory programming.', 2),
  ('b1000003-0000-4000-8000-000000000003', 'a1000310-0000-4000-8000-000000000310', 'a1000012-0000-4000-8000-000000000012', 'a1000603-0000-4000-8000-000000000603', 'Data Structures', 'CSC201', 'Lists, stacks, queues, trees.', 3),
  ('b1000004-0000-4000-8000-000000000004', 'a1000310-0000-4000-8000-000000000310', 'a1000012-0000-4000-8000-000000000012', 'a1000604-0000-4000-8000-000000000604', 'Discrete Mathematics', 'CSC202', 'Logic, sets, graphs for CS.', 4),
  ('b1000005-0000-4000-8000-000000000005', 'a1000310-0000-4000-8000-000000000310', 'a1000012-0000-4000-8000-000000000012', NULL, 'Computer Architecture', 'CSC203', 'Hardware and organization.', 5),
  ('b1000006-0000-4000-8000-000000000006', 'a1000310-0000-4000-8000-000000000310', 'a1000012-0000-4000-8000-000000000012', NULL, 'Database Systems', 'CSC301', 'Relational databases & SQL.', 6),
  ('b1000010-0000-4000-8000-000000000010', 'a1000315-0000-4000-8000-000000000315', 'a1000012-0000-4000-8000-000000000012', 'a1000605-0000-4000-8000-000000000605', 'Principles of Accounting I', 'ACC101', 'Accounting foundations.', 1),
  ('b1000011-0000-4000-8000-000000000011', 'a1000315-0000-4000-8000-000000000315', 'a1000012-0000-4000-8000-000000000012', 'a1000606-0000-4000-8000-000000000606', 'Principles of Accounting II', 'ACC102', 'Accounting continuation.', 2),
  ('b1000012-0000-4000-8000-000000000012', 'a1000315-0000-4000-8000-000000000315', 'a1000012-0000-4000-8000-000000000012', NULL, 'Cost Accounting', 'ACC201', 'Costing methods.', 3),
  ('b1000013-0000-4000-8000-000000000013', 'a1000315-0000-4000-8000-000000000315', 'a1000012-0000-4000-8000-000000000012', NULL, 'Financial Accounting', 'ACC202', 'Financial statements.', 4),
  ('b1000020-0000-4000-8000-000000000020', 'a1000317-0000-4000-8000-000000000317', 'a1000012-0000-4000-8000-000000000012', 'a1000607-0000-4000-8000-000000000607', 'Principles of Economics I', 'ECO101', 'Microeconomics intro.', 1),
  ('b1000021-0000-4000-8000-000000000021', 'a1000317-0000-4000-8000-000000000317', 'a1000012-0000-4000-8000-000000000012', NULL, 'Principles of Economics II', 'ECO102', 'Macroeconomics intro.', 2),
  ('b1000022-0000-4000-8000-000000000022', 'a1000317-0000-4000-8000-000000000317', 'a1000012-0000-4000-8000-000000000012', NULL, 'Mathematics for Economists', 'ECO201', 'Quantitative methods.', 3),
  ('b1000030-0000-4000-8000-000000000030', 'a1000316-0000-4000-8000-000000000316', 'a1000012-0000-4000-8000-000000000012', 'a1000608-0000-4000-8000-000000000608', 'Introduction to Business', 'BUS101', 'Business foundations.', 1),
  ('b1000031-0000-4000-8000-000000000031', 'a1000316-0000-4000-8000-000000000316', 'a1000012-0000-4000-8000-000000000012', NULL, 'Principles of Management', 'BUS102', 'Management theory.', 2),
  ('b1000032-0000-4000-8000-000000000032', 'a1000316-0000-4000-8000-000000000316', 'a1000012-0000-4000-8000-000000000012', NULL, 'Business Communication', 'BUS201', 'Workplace communication.', 3),
  ('b1000040-0000-4000-8000-000000000040', 'a1000311-0000-4000-8000-000000000311', 'a1000012-0000-4000-8000-000000000012', 'a1000609-0000-4000-8000-000000000609', 'Engineering Mathematics I', 'EEE101', 'Engineering maths.', 1),
  ('b1000041-0000-4000-8000-000000000041', 'a1000311-0000-4000-8000-000000000311', 'a1000012-0000-4000-8000-000000000012', NULL, 'Basic Electrical Engineering', 'EEE102', 'Circuits & devices.', 2),
  ('b1000042-0000-4000-8000-000000000042', 'a1000311-0000-4000-8000-000000000311', 'a1000012-0000-4000-8000-000000000012', NULL, 'Engineering Drawing', 'EEE103', 'Technical drawing practice.', 3),
  ('b1000050-0000-4000-8000-000000000050', 'a1000314-0000-4000-8000-000000000314', 'a1000012-0000-4000-8000-000000000012', 'a1000610-0000-4000-8000-000000000610', 'Introduction to Mass Communication', 'MAC101', 'Media foundations.', 1),
  ('b1000051-0000-4000-8000-000000000051', 'a1000314-0000-4000-8000-000000000314', 'a1000012-0000-4000-8000-000000000012', NULL, 'Writing for the Mass Media', 'MAC102', 'News & feature writing.', 2),
  ('b1000060-0000-4000-8000-000000000060', 'a1000318-0000-4000-8000-000000000318', 'a1000012-0000-4000-8000-000000000012', 'a1000611-0000-4000-8000-000000000611', 'Legal Method', 'LAW101', 'Introduction to legal study.', 1),
  ('b1000061-0000-4000-8000-000000000061', 'a1000318-0000-4000-8000-000000000318', 'a1000012-0000-4000-8000-000000000012', NULL, 'Nigerian Legal System', 'LAW102', 'Courts and sources of law.', 2),
  ('b1000070-0000-4000-8000-000000000070', 'a1000324-0000-4000-8000-000000000324', 'a1000012-0000-4000-8000-000000000012', 'a1000612-0000-4000-8000-000000000612', 'Use of English', 'GNS101', 'Communication skills.', 1),
  ('b1000071-0000-4000-8000-000000000071', 'a1000324-0000-4000-8000-000000000324', 'a1000012-0000-4000-8000-000000000012', 'a1000613-0000-4000-8000-000000000613', 'Nigerian Peoples and Culture', 'GNS102', 'Culture & society.', 2),
  ('b1000072-0000-4000-8000-000000000072', 'a1000324-0000-4000-8000-000000000324', 'a1000012-0000-4000-8000-000000000012', 'a1000614-0000-4000-8000-000000000614', 'Philosophy and Logic', 'GNS103', 'Critical thinking.', 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  catalogue_course_id = EXCLUDED.catalogue_course_id,
  is_published = true;

-- Theory + practical recommended books
INSERT INTO public.recommended_study_books (
  id, catalogue_course_id, programme_id, curriculum_subject_id, subject_label,
  title, author, edition, book_kind, description, order_index
) VALUES
  ('c1000001-0000-4000-8000-000000000001', 'a1000601-0000-4000-8000-000000000601', 'a1000310-0000-4000-8000-000000000310', 'b1000001-0000-4000-8000-000000000001', 'Introduction to Computer Science',
   'Computer Science: An Overview', 'J. Glenn Brookshear', '13th', 'theory', 'Core theory overview of CS concepts for beginners.', 1),
  ('c1000002-0000-4000-8000-000000000002', 'a1000601-0000-4000-8000-000000000601', 'a1000310-0000-4000-8000-000000000310', 'b1000001-0000-4000-8000-000000000001', 'Introduction to Computer Science',
   'CSC101 Lab Workbook — Computing Basics', 'StudySphere Curriculum', '2024', 'practical', 'Hands-on labs: OS basics, file systems, simple algorithms.', 2),
  ('c1000003-0000-4000-8000-000000000003', 'a1000602-0000-4000-8000-000000000602', 'a1000310-0000-4000-8000-000000000310', 'b1000002-0000-4000-8000-000000000002', 'Programming Fundamentals',
   'C How to Program', 'Deitel & Deitel', '8th', 'theory', 'Structured programming theory and language fundamentals.', 1),
  ('c1000004-0000-4000-8000-000000000004', 'a1000602-0000-4000-8000-000000000602', 'a1000310-0000-4000-8000-000000000310', 'b1000002-0000-4000-8000-000000000002', 'Programming Fundamentals',
   'Programming Fundamentals Practical Manual', 'StudySphere Curriculum', '2024', 'practical', 'Coding exercises, debugging drills, mini projects.', 2),
  ('c1000005-0000-4000-8000-000000000005', 'a1000603-0000-4000-8000-000000000603', 'a1000310-0000-4000-8000-000000000310', 'b1000003-0000-4000-8000-000000000003', 'Data Structures',
   'Data Structures Using C', 'Reema Thareja', '2nd', 'theory', 'Classic DS theory for Nigerian university courses.', 1),
  ('c1000006-0000-4000-8000-000000000006', 'a1000603-0000-4000-8000-000000000603', 'a1000310-0000-4000-8000-000000000310', 'b1000003-0000-4000-8000-000000000003', 'Data Structures',
   'Data Structures Lab Manual', 'StudySphere Curriculum', '2024', 'practical', 'Implement stacks, queues, linked lists, trees in code.', 2),
  ('c1000007-0000-4000-8000-000000000007', 'a1000604-0000-4000-8000-000000000604', 'a1000310-0000-4000-8000-000000000310', 'b1000004-0000-4000-8000-000000000004', 'Discrete Mathematics',
   'Discrete Mathematics and Its Applications', 'Kenneth Rosen', '8th', 'theory', 'Logic, proofs, combinatorics, graphs.', 1),
  ('c1000008-0000-4000-8000-000000000008', 'a1000604-0000-4000-8000-000000000604', 'a1000310-0000-4000-8000-000000000310', 'b1000004-0000-4000-8000-000000000004', 'Discrete Mathematics',
   'Discrete Maths Problem Set Book', 'StudySphere Curriculum', '2024', 'practical', 'Worked exercises and tutorial sheets.', 2),
  ('c1000010-0000-4000-8000-000000000010', 'a1000605-0000-4000-8000-000000000605', 'a1000315-0000-4000-8000-000000000315', 'b1000010-0000-4000-8000-000000000010', 'Principles of Accounting I',
   'Financial Accounting', 'Wood & Sangster', '14th', 'theory', 'Introductory financial accounting theory.', 1),
  ('c1000011-0000-4000-8000-000000000011', 'a1000605-0000-4000-8000-000000000605', 'a1000315-0000-4000-8000-000000000315', 'b1000010-0000-4000-8000-000000000010', 'Principles of Accounting I',
   'Accounting Practical Workbook I', 'StudySphere Curriculum', '2024', 'practical', 'Journals, ledgers, trial balance practice.', 2),
  ('c1000012-0000-4000-8000-000000000012', 'a1000606-0000-4000-8000-000000000606', 'a1000315-0000-4000-8000-000000000315', 'b1000011-0000-4000-8000-000000000011', 'Principles of Accounting II',
   'Advanced Financial Accounting', 'Lewis & Pendrill', 'Latest', 'theory', 'Partnerships, companies, adjustments.', 1),
  ('c1000013-0000-4000-8000-000000000013', 'a1000606-0000-4000-8000-000000000606', 'a1000315-0000-4000-8000-000000000315', 'b1000011-0000-4000-8000-000000000011', 'Principles of Accounting II',
   'Accounting Practical Workbook II', 'StudySphere Curriculum', '2024', 'practical', 'Final accounts and adjustments drills.', 2),
  ('c1000020-0000-4000-8000-000000000020', 'a1000607-0000-4000-8000-000000000607', 'a1000317-0000-4000-8000-000000000317', 'b1000020-0000-4000-8000-000000000020', 'Principles of Economics I',
   'Principles of Economics', 'N. Gregory Mankiw', '9th', 'theory', 'Microeconomic theory fundamentals.', 1),
  ('c1000021-0000-4000-8000-000000000021', 'a1000607-0000-4000-8000-000000000607', 'a1000317-0000-4000-8000-000000000317', 'b1000020-0000-4000-8000-000000000020', 'Principles of Economics I',
   'Economics Tutorial & Graph Practice', 'StudySphere Curriculum', '2024', 'practical', 'Demand/supply graphs and numerical drills.', 2),
  ('c1000030-0000-4000-8000-000000000030', 'a1000608-0000-4000-8000-000000000608', 'a1000316-0000-4000-8000-000000000316', 'b1000030-0000-4000-8000-000000000030', 'Introduction to Business',
   'Business: A Changing World', 'Ferrell et al.', 'Latest', 'theory', 'Business environment and functions.', 1),
  ('c1000031-0000-4000-8000-000000000031', 'a1000608-0000-4000-8000-000000000608', 'a1000316-0000-4000-8000-000000000316', 'b1000030-0000-4000-8000-000000000030', 'Introduction to Business',
   'Business Case Study Workbook', 'StudySphere Curriculum', '2024', 'practical', 'Short cases and SWOT practice.', 2),
  ('c1000040-0000-4000-8000-000000000040', 'a1000609-0000-4000-8000-000000000609', 'a1000311-0000-4000-8000-000000000311', 'b1000040-0000-4000-8000-000000000040', 'Engineering Mathematics I',
   'Engineering Mathematics', 'K.A. Stroud', '8th', 'theory', 'Core engineering maths theory.', 1),
  ('c1000041-0000-4000-8000-000000000041', 'a1000609-0000-4000-8000-000000000609', 'a1000311-0000-4000-8000-000000000311', 'b1000040-0000-4000-8000-000000000040', 'Engineering Mathematics I',
   'Engineering Maths Practice Book', 'StudySphere Curriculum', '2024', 'practical', 'Worked examples and past-style problems.', 2),
  ('c1000050-0000-4000-8000-000000000050', 'a1000610-0000-4000-8000-000000000610', 'a1000314-0000-4000-8000-000000000314', 'b1000050-0000-4000-8000-000000000050', 'Introduction to Mass Communication',
   'Mass Communication: An Introduction', 'John Vivian', 'Latest', 'theory', 'Media theory and communication models.', 1),
  ('c1000051-0000-4000-8000-000000000051', 'a1000610-0000-4000-8000-000000000610', 'a1000314-0000-4000-8000-000000000314', 'b1000050-0000-4000-8000-000000000050', 'Introduction to Mass Communication',
   'Media Writing Practice Pack', 'StudySphere Curriculum', '2024', 'practical', 'Headline, lead, and news writing drills.', 2),
  ('c1000060-0000-4000-8000-000000000060', 'a1000611-0000-4000-8000-000000000611', 'a1000318-0000-4000-8000-000000000318', 'b1000060-0000-4000-8000-000000000060', 'Legal Method',
   'Introduction to Nigerian Legal Method', 'Obilade / standard text', 'Latest', 'theory', 'Legal method and sources of law.', 1),
  ('c1000061-0000-4000-8000-000000000061', 'a1000611-0000-4000-8000-000000000611', 'a1000318-0000-4000-8000-000000000318', 'b1000060-0000-4000-8000-000000000060', 'Legal Method',
   'Legal Method Case Brief Workbook', 'StudySphere Curriculum', '2024', 'practical', 'Case briefing and statute reading practice.', 2),
  ('c1000070-0000-4000-8000-000000000070', 'a1000612-0000-4000-8000-000000000612', 'a1000324-0000-4000-8000-000000000324', 'b1000070-0000-4000-8000-000000000070', 'Use of English',
   'English Language Skills for Tertiary Students', 'StudySphere Curriculum', '2024', 'theory', 'Grammar, comprehension, academic writing theory.', 1),
  ('c1000071-0000-4000-8000-000000000071', 'a1000612-0000-4000-8000-000000000612', 'a1000324-0000-4000-8000-000000000324', 'b1000070-0000-4000-8000-000000000070', 'Use of English',
   'Use of English Practice Workbook', 'StudySphere Curriculum', '2024', 'practical', 'Essay, summary, and lexis exercises.', 2),
  ('c1000072-0000-4000-8000-000000000072', 'a1000613-0000-4000-8000-000000000613', 'a1000324-0000-4000-8000-000000000324', 'b1000071-0000-4000-8000-000000000071', 'Nigerian Peoples and Culture',
   'Nigerian Peoples and Culture Reader', 'StudySphere Curriculum', '2024', 'theory', 'Culture, history, and national identity themes.', 1),
  ('c1000073-0000-4000-8000-000000000073', 'a1000613-0000-4000-8000-000000000613', 'a1000324-0000-4000-8000-000000000324', 'b1000071-0000-4000-8000-000000000071', 'Nigerian Peoples and Culture',
   'NPC Discussion & Assignment Pack', 'StudySphere Curriculum', '2024', 'practical', 'Seminar questions and reflection tasks.', 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  author = EXCLUDED.author,
  book_kind = EXCLUDED.book_kind,
  description = EXCLUDED.description,
  is_published = true;
