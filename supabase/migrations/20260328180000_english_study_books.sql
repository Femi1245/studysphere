-- Seed English & Literary Studies curriculum subjects + study books
-- Programme: B.A. English and Literary Studies (a1000377-...)

INSERT INTO public.curriculum_subjects (
  id, programme_id, education_level_id, catalogue_course_id, name, code, description, order_index
) VALUES
  ('b1000080-0000-4000-8000-000000000080', 'a1000377-0000-4000-8000-000000000377', 'a1000012-0000-4000-8000-000000000012', NULL, 'Introduction to Literary Studies', 'ENG101', 'Close reading and literary terms.', 1),
  ('b1000081-0000-4000-8000-000000000081', 'a1000377-0000-4000-8000-000000000377', 'a1000012-0000-4000-8000-000000000012', NULL, 'English Language Skills', 'ENG102', 'Grammar and academic writing.', 2),
  ('b1000082-0000-4000-8000-000000000082', 'a1000377-0000-4000-8000-000000000377', 'a1000012-0000-4000-8000-000000000012', NULL, 'African Literature', 'ENG201', 'African and Nigerian literary texts.', 3),
  ('b1000083-0000-4000-8000-000000000083', 'a1000377-0000-4000-8000-000000000377', 'a1000012-0000-4000-8000-000000000012', NULL, 'Drama and Poetry', 'ENG202', 'Dramatic and poetic forms.', 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  is_published = true;

INSERT INTO public.recommended_study_books (
  id, catalogue_course_id, programme_id, curriculum_subject_id, subject_label,
  title, author, edition, book_kind, description, order_index
) VALUES
  ('c1000080-0000-4000-8000-000000000080', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000080-0000-4000-8000-000000000080', 'Introduction to Literary Studies',
   'The Norton Introduction to Literature', 'Mays / Norton', 'Latest', 'theory', 'Core genres and close reading for BA English.', 1),
  ('c1000081-0000-4000-8000-000000000081', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000080-0000-4000-8000-000000000080', 'Introduction to Literary Studies',
   'Literary Analysis Practice Workbook', 'StudySphere Curriculum', '2024', 'practical', 'Passage analysis and critical response drills.', 2),
  ('c1000082-0000-4000-8000-000000000082', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000081-0000-4000-8000-000000000081', 'English Language Skills',
   'A University Grammar of English', 'Quirk & Greenbaum', 'Latest', 'theory', 'Grammar and usage for tertiary English.', 1),
  ('c1000083-0000-4000-8000-000000000083', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000081-0000-4000-8000-000000000081', 'English Language Skills',
   'Use of English Practice Pack', 'StudySphere Curriculum', '2024', 'practical', 'Essay, summary, and comprehension exercises.', 2),
  ('c1000084-0000-4000-8000-000000000084', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000082-0000-4000-8000-000000000082', 'African Literature',
   'African Literature: An Anthology of Criticism and Theory', 'Olaniyan & Quayson (eds.)', 'Latest', 'theory', 'Criticism and contexts for African literature.', 1),
  ('c1000085-0000-4000-8000-000000000085', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000082-0000-4000-8000-000000000082', 'African Literature',
   'Text Seminar & Character Study Pack', 'StudySphere Curriculum', '2024', 'practical', 'Discussion questions and theme worksheets.', 2),
  ('c1000086-0000-4000-8000-000000000086', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000083-0000-4000-8000-000000000083', 'Drama and Poetry',
   'An Introduction to Drama and Poetry', 'Standard tertiary reader', 'Latest', 'theory', 'Forms, devices, and major movements.', 1),
  ('c1000087-0000-4000-8000-000000000087', NULL, 'a1000377-0000-4000-8000-000000000377', 'b1000083-0000-4000-8000-000000000083', 'Drama and Poetry',
   'Scansion & Scene Performance Workbook', 'StudySphere Curriculum', '2024', 'practical', 'Prosody practice and scene annotation.', 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  author = EXCLUDED.author,
  book_kind = EXCLUDED.book_kind,
  description = EXCLUDED.description,
  subject_label = EXCLUDED.subject_label,
  programme_id = EXCLUDED.programme_id,
  is_published = true;
