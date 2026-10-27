-- Nigeria-first catalogue seed (idempotent where possible)

-- Fixed UUIDs for stable references across re-runs
-- Country & education levels
-- a1000000-0000-4000-8000-0000000000xx

INSERT INTO public.countries (id, code, name)
VALUES ('a1000001-0000-4000-8000-000000000001', 'NG', 'Nigeria')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.education_levels (id, code, label, sort_order)
VALUES
  ('a1000010-0000-4000-8000-000000000010', 'junior_secondary', 'Junior Secondary School', 10),
  ('a1000011-0000-4000-8000-000000000011', 'senior_secondary', 'Senior Secondary School', 20),
  ('a1000012-0000-4000-8000-000000000012', 'university', 'University', 30),
  ('a1000013-0000-4000-8000-000000000013', 'polytechnic', 'Polytechnic', 40),
  ('a1000014-0000-4000-8000-000000000014', 'college_of_education', 'College of Education', 50),
  ('a1000015-0000-4000-8000-000000000015', 'other_tertiary', 'Other Tertiary', 60)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- Class levels
INSERT INTO public.class_levels (id, education_level_id, code, label, sort_order)
VALUES
  ('a1000021-0000-4000-8000-000000000021', 'a1000010-0000-4000-8000-000000000010', 'JSS1', 'JSS 1', 1),
  ('a1000022-0000-4000-8000-000000000022', 'a1000010-0000-4000-8000-000000000010', 'JSS2', 'JSS 2', 2),
  ('a1000023-0000-4000-8000-000000000023', 'a1000010-0000-4000-8000-000000000010', 'JSS3', 'JSS 3', 3),
  ('a1000024-0000-4000-8000-000000000024', 'a1000011-0000-4000-8000-000000000011', 'SS1', 'SS 1', 1),
  ('a1000025-0000-4000-8000-000000000025', 'a1000011-0000-4000-8000-000000000011', 'SS2', 'SS 2', 2),
  ('a1000026-0000-4000-8000-000000000026', 'a1000011-0000-4000-8000-000000000011', 'SS3', 'SS 3', 3),
  ('a1000031-0000-4000-8000-000000000031', 'a1000012-0000-4000-8000-000000000012', '100', '100 Level', 1),
  ('a1000032-0000-4000-8000-000000000032', 'a1000012-0000-4000-8000-000000000012', '200', '200 Level', 2),
  ('a1000033-0000-4000-8000-000000000033', 'a1000012-0000-4000-8000-000000000012', '300', '300 Level', 3),
  ('a1000034-0000-4000-8000-000000000034', 'a1000012-0000-4000-8000-000000000012', '400', '400 Level', 4),
  ('a1000035-0000-4000-8000-000000000035', 'a1000012-0000-4000-8000-000000000012', '500', '500 Level', 5),
  ('a1000036-0000-4000-8000-000000000036', 'a1000012-0000-4000-8000-000000000012', '600', '600 Level', 6),
  ('a1000041-0000-4000-8000-000000000041', 'a1000013-0000-4000-8000-000000000013', 'ND1', 'ND 1', 1),
  ('a1000042-0000-4000-8000-000000000042', 'a1000013-0000-4000-8000-000000000013', 'ND2', 'ND 2', 2),
  ('a1000043-0000-4000-8000-000000000043', 'a1000013-0000-4000-8000-000000000013', 'HND1', 'HND 1', 3),
  ('a1000044-0000-4000-8000-000000000044', 'a1000013-0000-4000-8000-000000000013', 'HND2', 'HND 2', 4),
  ('a1000051-0000-4000-8000-000000000051', 'a1000014-0000-4000-8000-000000000014', 'NCE1', 'NCE 1', 1),
  ('a1000052-0000-4000-8000-000000000052', 'a1000014-0000-4000-8000-000000000014', 'NCE2', 'NCE 2', 2),
  ('a1000053-0000-4000-8000-000000000053', 'a1000014-0000-4000-8000-000000000014', 'NCE3', 'NCE 3', 3)
ON CONFLICT (education_level_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.academic_sessions (id, label, starts_on, ends_on, is_current)
VALUES
  ('a1000061-0000-4000-8000-000000000061', '2024/2025', '2024-09-01', '2025-08-31', false),
  ('a1000062-0000-4000-8000-000000000062', '2025/2026', '2025-09-01', '2026-08-31', true)
ON CONFLICT (label) DO UPDATE SET
  starts_on = EXCLUDED.starts_on,
  ends_on = EXCLUDED.ends_on,
  is_current = EXCLUDED.is_current;

-- Ensure only one current session
UPDATE public.academic_sessions
SET is_current = (label = '2025/2026');

INSERT INTO public.institutions (id, country_id, name, institution_type, state_region, is_active)
VALUES
  (
    'a1000101-0000-4000-8000-000000000101',
    'a1000001-0000-4000-8000-000000000001',
    'Nigerian Secondary Curriculum',
    'secondary',
    NULL,
    true
  ),
  (
    'a1000102-0000-4000-8000-000000000102',
    'a1000001-0000-4000-8000-000000000001',
    'University of Lagos',
    'university',
    'Lagos',
    true
  ),
  (
    'a1000103-0000-4000-8000-000000000103',
    'a1000001-0000-4000-8000-000000000001',
    'University of Ibadan',
    'university',
    'Oyo',
    true
  ),
  (
    'a1000104-0000-4000-8000-000000000104',
    'a1000001-0000-4000-8000-000000000001',
    'Obafemi Awolowo University',
    'university',
    'Osun',
    true
  ),
  (
    'a1000105-0000-4000-8000-000000000105',
    'a1000001-0000-4000-8000-000000000001',
    'Yaba College of Technology',
    'polytechnic',
    'Lagos',
    true
  ),
  (
    'a1000106-0000-4000-8000-000000000106',
    'a1000001-0000-4000-8000-000000000001',
    'Federal College of Education (Technical) Akoka',
    'college_of_education',
    'Lagos',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  institution_type = EXCLUDED.institution_type,
  state_region = EXCLUDED.state_region,
  is_active = EXCLUDED.is_active;

INSERT INTO public.departments (id, institution_id, name, code)
VALUES
  ('a1000201-0000-4000-8000-000000000201', 'a1000102-0000-4000-8000-000000000102', 'Computer Sciences', 'CSC'),
  ('a1000202-0000-4000-8000-000000000202', 'a1000103-0000-4000-8000-000000000103', 'Medicine and Surgery', 'MED'),
  ('a1000203-0000-4000-8000-000000000203', 'a1000105-0000-4000-8000-000000000105', 'Computer Technology', 'CT'),
  ('a1000204-0000-4000-8000-000000000204', 'a1000106-0000-4000-8000-000000000106', 'Science Education', 'SED')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  institution_id = EXCLUDED.institution_id;

INSERT INTO public.programmes (id, institution_id, education_level_id, department_id, name, code, is_active)
VALUES
  (
    'a1000301-0000-4000-8000-000000000301',
    'a1000102-0000-4000-8000-000000000102',
    'a1000012-0000-4000-8000-000000000012',
    'a1000201-0000-4000-8000-000000000201',
    'Computer Science B.Sc',
    'CSC-BSC',
    true
  ),
  (
    'a1000302-0000-4000-8000-000000000302',
    'a1000103-0000-4000-8000-000000000103',
    'a1000012-0000-4000-8000-000000000012',
    'a1000202-0000-4000-8000-000000000202',
    'Medicine and Surgery (MBBS)',
    'MBBS',
    true
  ),
  (
    'a1000303-0000-4000-8000-000000000303',
    'a1000105-0000-4000-8000-000000000105',
    'a1000013-0000-4000-8000-000000000013',
    'a1000203-0000-4000-8000-000000000203',
    'ND Computer Science',
    'ND-CSC',
    true
  ),
  (
    'a1000304-0000-4000-8000-000000000304',
    'a1000106-0000-4000-8000-000000000106',
    'a1000014-0000-4000-8000-000000000014',
    'a1000204-0000-4000-8000-000000000204',
    'NCE Mathematics/Physics',
    'NCE-MATPHY',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  is_active = EXCLUDED.is_active;

-- Secondary catalogue courses (national curriculum placeholder courses)
INSERT INTO public.catalogue_courses (
  id, institution_id, programme_id, education_level_id, class_level_id,
  code, title, description, is_published
)
VALUES
  ('a1000401-0000-4000-8000-000000000401', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000010-0000-4000-8000-000000000010', NULL, 'JSS-MATH', 'Mathematics (Junior Secondary)', 'Sample StudySphere junior secondary mathematics catalogue entry.', true),
  ('a1000402-0000-4000-8000-000000000402', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000010-0000-4000-8000-000000000010', NULL, 'JSS-ENG', 'English Language (Junior Secondary)', 'Sample junior secondary English catalogue entry.', true),
  ('a1000403-0000-4000-8000-000000000403', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000010-0000-4000-8000-000000000010', 'a1000021-0000-4000-8000-000000000021', 'JSS-BIO', 'Basic Science / Biology (JSS1)', 'Introductory biology concepts for JSS1 learners.', true),
  ('a1000404-0000-4000-8000-000000000404', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-CHEM', 'Chemistry (Senior Secondary)', 'Senior secondary chemistry catalogue entry.', true),
  ('a1000405-0000-4000-8000-000000000405', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-PHY', 'Physics (Senior Secondary)', 'Senior secondary physics catalogue entry.', true),
  ('a1000406-0000-4000-8000-000000000406', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-ECON', 'Economics (Senior Secondary)', 'Senior secondary economics catalogue entry.', true),
  ('a1000407-0000-4000-8000-000000000407', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-GOV', 'Government (Senior Secondary)', 'Senior secondary government catalogue entry.', true),
  ('a1000408-0000-4000-8000-000000000408', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-LIT', 'Literature-in-English (Senior Secondary)', 'Senior secondary literature catalogue entry.', true),
  ('a1000409-0000-4000-8000-000000000409', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-GEO', 'Geography (Senior Secondary)', 'Senior secondary geography catalogue entry.', true),
  ('a1000410-0000-4000-8000-000000000410', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000010-0000-4000-8000-000000000010', NULL, 'JSS-CIV', 'Civic Education (Junior Secondary)', 'Junior secondary civic education catalogue entry.', true),
  ('a1000411-0000-4000-8000-000000000411', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-AGRIC', 'Agricultural Science (Senior Secondary)', 'Senior secondary agricultural science catalogue entry.', true),
  ('a1000412-0000-4000-8000-000000000412', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', 'a1000026-0000-4000-8000-000000000026', 'SS-FMATH', 'Further Mathematics (SS3)', 'Further mathematics for SS3 students.', true),
  ('a1000413-0000-4000-8000-000000000413', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-MATH', 'Mathematics (Senior Secondary)', 'Senior secondary mathematics catalogue entry.', true),
  ('a1000414-0000-4000-8000-000000000414', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-ENG', 'English Language (Senior Secondary)', 'Senior secondary English catalogue entry.', true),
  ('a1000415-0000-4000-8000-000000000415', 'a1000101-0000-4000-8000-000000000101', NULL, 'a1000011-0000-4000-8000-000000000011', NULL, 'SS-BIO', 'Biology (Senior Secondary)', 'Senior secondary biology catalogue entry.', true),
  ('a1000501-0000-4000-8000-000000000501', 'a1000102-0000-4000-8000-000000000102', 'a1000301-0000-4000-8000-000000000301', 'a1000012-0000-4000-8000-000000000012', 'a1000031-0000-4000-8000-000000000031', 'CSC101', 'Introduction to Computer Science', 'First-year introduction to computing concepts (sample StudySphere course).', true),
  ('a1000502-0000-4000-8000-000000000502', 'a1000102-0000-4000-8000-000000000102', 'a1000301-0000-4000-8000-000000000301', 'a1000012-0000-4000-8000-000000000012', 'a1000031-0000-4000-8000-000000000031', 'CSC102', 'Programming Fundamentals I', 'Introductory programming with pseudocode and Python-style examples (sample).', true),
  ('a1000503-0000-4000-8000-000000000503', 'a1000103-0000-4000-8000-000000000103', 'a1000302-0000-4000-8000-000000000302', 'a1000012-0000-4000-8000-000000000012', 'a1000031-0000-4000-8000-000000000031', 'MED101', 'Introduction to Medical Sciences', 'Orientation to medical study skills (sample StudySphere content).', true),
  ('a1000504-0000-4000-8000-000000000504', 'a1000105-0000-4000-8000-000000000105', 'a1000303-0000-4000-8000-000000000303', 'a1000013-0000-4000-8000-000000000013', 'a1000041-0000-4000-8000-000000000041', 'CT101', 'Computer Appreciation', 'ND1 computer appreciation (sample).', true),
  ('a1000505-0000-4000-8000-000000000505', 'a1000106-0000-4000-8000-000000000106', 'a1000304-0000-4000-8000-000000000304', 'a1000014-0000-4000-8000-000000000014', 'a1000051-0000-4000-8000-000000000051', 'SED201', 'Teaching Mathematics in Basic Schools', 'NCE mathematics pedagogy overview (sample).', true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_published = EXCLUDED.is_published;

-- Sample published learning materials (clearly marked sample content)
INSERT INTO public.learning_materials (
  id, catalogue_course_id, title, material_type, content_html, source_label,
  is_ai_generated, is_verified, status, published_at
)
VALUES
  (
    'a1000601-0000-4000-8000-000000000601',
    'a1000401-0000-4000-8000-000000000401',
    'Sample: Number Bases Overview (JSS Mathematics)',
    'study_guide',
    '<p><strong>StudySphere sample content.</strong> This is not an official Nigerian curriculum document. It introduces number bases for junior secondary learners: base 10 (decimal), base 2 (binary), and base 16 (hexadecimal). Practice converting small whole numbers between bases using repeated division.</p><p>Example: 13<sub>10</sub> = 1101<sub>2</sub>.</p>',
    'StudySphere Sample Content',
    false,
    true,
    'published',
    now()
  ),
  (
    'a1000602-0000-4000-8000-000000000602',
    'a1000401-0000-4000-8000-000000000401',
    'Sample: Fractions Quick Revision (JSS Mathematics)',
    'revision_summary',
    '<p><strong>StudySphere sample content.</strong> Review adding and subtracting fractions with like denominators, simplifying results, and checking answers with estimation. Always find a common denominator when denominators differ.</p>',
    'StudySphere Sample Content',
    false,
    true,
    'published',
    now()
  ),
  (
    'a1000603-0000-4000-8000-000000000603',
    'a1000501-0000-4000-8000-000000000501',
    'Sample: What is Computer Science? (CSC101)',
    'lecture_notes',
    '<p><strong>StudySphere sample content.</strong> Computer science studies how we represent information, design algorithms, and build software systems. This sample note covers data, algorithms, programs, and the role of abstraction—not official UNILAG course material.</p><ul><li>Data: facts encoded as bits</li><li>Algorithm: step-by-step procedure</li><li>Program: algorithm written for a machine</li></ul>',
    'StudySphere Sample Content',
    false,
    true,
    'published',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content_html = EXCLUDED.content_html,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at;

INSERT INTO public.question_banks (id, catalogue_course_id, education_level_id, title, description, is_published)
VALUES
  (
    'a1000701-0000-4000-8000-000000000701',
    'a1000401-0000-4000-8000-000000000401',
    'a1000010-0000-4000-8000-000000000010',
    'Sample JSS Mathematics Question Bank',
    'StudySphere sample questions for junior secondary mathematics practice.',
    true
  ),
  (
    'a1000702-0000-4000-8000-000000000702',
    'a1000501-0000-4000-8000-000000000501',
    'a1000012-0000-4000-8000-000000000012',
    'Sample CSC101 Question Bank',
    'StudySphere sample questions for introduction to computer science.',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- 15 Mathematics bank questions
INSERT INTO public.bank_questions (
  id, bank_id, topic_label, difficulty, question_type, prompt, options, correct_answer, explanation, order_index
)
VALUES
  ('a1000801-0000-4000-8000-000000000801', 'a1000701-0000-4000-8000-000000000701', 'Number bases', 'easy', 'multiple_choice', 'What is 5 in binary?', '["101", "110", "111", "100"]'::jsonb, '101', '5 decimal is 101 in binary.', 1),
  ('a1000802-0000-4000-8000-000000000802', 'a1000701-0000-4000-8000-000000000701', 'Fractions', 'easy', 'true_false', '1/2 + 1/2 equals 1.', NULL, 'true', 'Two halves make a whole.', 2),
  ('a1000803-0000-4000-8000-000000000803', 'a1000701-0000-4000-8000-000000000701', 'Fractions', 'medium', 'multiple_choice', 'Simplify 6/9.', '["2/3", "3/2", "1/3", "3/4"]'::jsonb, '2/3', 'Divide numerator and denominator by 3.', 3),
  ('a1000804-0000-4000-8000-000000000804', 'a1000701-0000-4000-8000-000000000701', 'Percentages', 'medium', 'multiple_choice', 'What is 20% of 150?', '["20", "25", "30", "35"]'::jsonb, '30', '0.2 × 150 = 30.', 4),
  ('a1000805-0000-4000-8000-000000000805', 'a1000701-0000-4000-8000-000000000701', 'Algebra', 'easy', 'multiple_choice', 'If x + 3 = 10, what is x?', '["6", "7", "8", "13"]'::jsonb, '7', 'Subtract 3 from both sides.', 5),
  ('a1000806-0000-4000-8000-000000000806', 'a1000701-0000-4000-8000-000000000701', 'Geometry', 'easy', 'true_false', 'A square has four equal sides.', NULL, 'true', 'All sides of a square are equal.', 6),
  ('a1000807-0000-4000-8000-000000000807', 'a1000701-0000-4000-8000-000000000701', 'Geometry', 'medium', 'multiple_choice', 'What is the area of a rectangle 4 cm by 5 cm?', '["9 cm²", "18 cm²", "20 cm²", "25 cm²"]'::jsonb, '20 cm²', 'Area = length × width.', 7),
  ('a1000808-0000-4000-8000-000000000808', 'a1000701-0000-4000-8000-000000000701', 'Ratio', 'medium', 'multiple_choice', 'Share ₦60 in ratio 2:1. Larger share?', '["₦20", "₦30", "₦40", "₦45"]'::jsonb, '₦40', '2+1 parts; each part ₦20.', 8),
  ('a1000809-0000-4000-8000-000000000809', 'a1000701-0000-4000-8000-000000000701', 'Statistics', 'hard', 'multiple_choice', 'Mean of 2, 4, 6, 8?', '["4", "5", "6", "7"]'::jsonb, '5', 'Sum 20 divided by 4.', 9),
  ('a1000810-0000-4000-8000-000000000810', 'a1000701-0000-4000-8000-000000000701', 'Indices', 'hard', 'multiple_choice', 'Value of 2³?', '["6", "8", "9", "12"]'::jsonb, '8', '2 × 2 × 2 = 8.', 10),
  ('a1000811-0000-4000-8000-000000000811', 'a1000701-0000-4000-8000-000000000701', 'Number bases', 'medium', 'true_false', 'Hexadecimal uses base 16.', NULL, 'true', 'Hex digits include 0–9 and A–F.', 11),
  ('a1000812-0000-4000-8000-000000000812', 'a1000701-0000-4000-8000-000000000701', 'Algebra', 'hard', 'short_answer', 'Expand 2(x + 3).', NULL, '2x + 6', 'Distribute 2 across the bracket.', 12),
  ('a1000813-0000-4000-8000-000000000813', 'a1000701-0000-4000-8000-000000000701', 'Percentages', 'easy', 'true_false', '50% is the same as one half.', NULL, 'true', '50% = 1/2.', 13),
  ('a1000814-0000-4000-8000-000000000814', 'a1000701-0000-4000-8000-000000000701', 'Geometry', 'hard', 'multiple_choice', 'Sum of interior angles of a triangle?', '["90°", "180°", "270°", "360°"]'::jsonb, '180°', 'Standard triangle angle sum.', 14),
  ('a1000815-0000-4000-8000-000000000815', 'a1000701-0000-4000-8000-000000000701', 'Ratio', 'easy', 'multiple_choice', 'Ratio 1:3 means for every 1 part there are how many of the second?', '["1", "2", "3", "4"]'::jsonb, '3', 'Second term is 3 parts.', 15)
ON CONFLICT (id) DO UPDATE SET
  prompt = EXCLUDED.prompt,
  correct_answer = EXCLUDED.correct_answer,
  order_index = EXCLUDED.order_index;

-- 10 CSC101 bank questions
INSERT INTO public.bank_questions (
  id, bank_id, topic_label, difficulty, question_type, prompt, options, correct_answer, explanation, order_index
)
VALUES
  ('a1000901-0000-4000-8000-000000000901', 'a1000702-0000-4000-8000-000000000702', 'Definitions', 'easy', 'multiple_choice', 'Which best describes an algorithm?', '["A computer brand", "A step-by-step procedure", "A type of memory", "A network cable"]'::jsonb, 'A step-by-step procedure', 'Algorithms are ordered steps to solve a problem.', 1),
  ('a1000902-0000-4000-8000-000000000902', 'a1000702-0000-4000-8000-000000000702', 'Data', 'easy', 'true_false', 'All data in a computer is ultimately stored as bits.', NULL, 'true', 'Binary digits encode information.', 2),
  ('a1000903-0000-4000-8000-000000000903', 'a1000702-0000-4000-8000-000000000702', 'Programming', 'medium', 'multiple_choice', 'A syntax error occurs when:', '["The program runs slowly", "Code violates language rules", "The user enters wrong data", "The CPU overheats"]'::jsonb, 'Code violates language rules', 'Syntax errors break grammar of the language.', 3),
  ('a1000904-0000-4000-8000-000000000904', 'a1000702-0000-4000-8000-000000000702', 'Abstraction', 'medium', 'true_false', 'Abstraction hides unnecessary detail.', NULL, 'true', 'Abstraction focuses on essential features.', 4),
  ('a1000905-0000-4000-8000-000000000905', 'a1000702-0000-4000-8000-000000000702', 'Hardware', 'easy', 'multiple_choice', 'Which is input device?', '["Monitor", "Keyboard", "Printer", "Speaker"]'::jsonb, 'Keyboard', 'Keyboard sends data to the computer.', 5),
  ('a1000906-0000-4000-8000-000000000906', 'a1000702-0000-4000-8000-000000000702', 'Software', 'medium', 'multiple_choice', 'Operating system is an example of:', '["Application software", "System software", "Utility belt", "Firmware only"]'::jsonb, 'System software', 'OS manages hardware and resources.', 6),
  ('a1000907-0000-4000-8000-000000000907', 'a1000702-0000-4000-8000-000000000702', 'Logic', 'hard', 'multiple_choice', 'NOT (true) equals:', '["true", "false", "null", "undefined"]'::jsonb, 'false', 'Logical NOT inverts the value.', 7),
  ('a1000908-0000-4000-8000-000000000908', 'a1000702-0000-4000-8000-000000000702', 'Programming', 'hard', 'short_answer', 'Name one high-level programming language.', NULL, 'Python', 'Accept any common high-level language name.', 8),
  ('a1000909-0000-4000-8000-000000000909', 'a1000702-0000-4000-8000-000000000702', 'Networks', 'medium', 'true_false', 'The Internet is a global network of networks.', NULL, 'true', 'Internet interconnects many networks.', 9),
  ('a1000910-0000-4000-8000-000000000910', 'a1000702-0000-4000-8000-000000000702', 'Ethics', 'easy', 'multiple_choice', 'Respecting software licenses is part of:', '["Hardware design", "Computer ethics", "Binary math", "File compression"]'::jsonb, 'Computer ethics', 'Ethical use includes license compliance.', 10)
ON CONFLICT (id) DO UPDATE SET
  prompt = EXCLUDED.prompt,
  correct_answer = EXCLUDED.correct_answer,
  order_index = EXCLUDED.order_index;

INSERT INTO public.platform_settings (key, value)
VALUES ('default_pass_mark', '50'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
