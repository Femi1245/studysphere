-- Fix empty Programme dropdown: seed shared departments/programmes using education_levels.code
-- (works even when education level UUIDs are not the original a1000… seed IDs).

-- Ensure education levels exist
INSERT INTO public.education_levels (code, label, sort_order)
VALUES
  ('junior_secondary', 'Junior Secondary School', 10),
  ('senior_secondary', 'Senior Secondary School', 20),
  ('university', 'University', 30),
  ('polytechnic', 'Polytechnic', 40),
  ('college_of_education', 'College of Education', 50),
  ('other_tertiary', 'Other Tertiary', 60)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- Shared departments (idempotent by code where possible via fixed ids)
INSERT INTO public.departments (id, institution_id, name, code)
VALUES
  ('a1000210-0000-4000-8000-000000000210', NULL, 'Computer Science', 'CSC'),
  ('a1000211-0000-4000-8000-000000000211', NULL, 'Electrical / Electronic Engineering', 'EEE'),
  ('a1000212-0000-4000-8000-000000000212', NULL, 'Mechanical Engineering', 'MEE'),
  ('a1000213-0000-4000-8000-000000000213', NULL, 'Civil Engineering', 'CVE'),
  ('a1000214-0000-4000-8000-000000000214', NULL, 'Mass Communication', 'MAC'),
  ('a1000215-0000-4000-8000-000000000215', NULL, 'Accounting', 'ACC'),
  ('a1000216-0000-4000-8000-000000000216', NULL, 'Business Administration', 'BUS'),
  ('a1000217-0000-4000-8000-000000000217', NULL, 'Economics', 'ECO'),
  ('a1000218-0000-4000-8000-000000000218', NULL, 'Law', 'LAW'),
  ('a1000219-0000-4000-8000-000000000219', NULL, 'Medicine and Surgery', 'MED'),
  ('a1000220-0000-4000-8000-000000000220', NULL, 'Nursing Science', 'NSC'),
  ('a1000221-0000-4000-8000-000000000221', NULL, 'Microbiology', 'MCB'),
  ('a1000225-0000-4000-8000-000000000225', NULL, 'Mathematics', 'MTH'),
  ('a1000226-0000-4000-8000-000000000226', NULL, 'Physics', 'PHY'),
  ('a1000227-0000-4000-8000-000000000227', NULL, 'Chemistry', 'CHM'),
  ('a1000223-0000-4000-8000-000000000223', NULL, 'Political Science', 'POL'),
  ('a1000224-0000-4000-8000-000000000224', NULL, 'English and Literary Studies', 'ENG'),
  ('a1000228-0000-4000-8000-000000000228', NULL, 'Education', 'EDU'),
  ('a1000229-0000-4000-8000-000000000229', NULL, 'General Studies', 'GNS'),
  ('a1000232-0000-4000-8000-000000000232', NULL, 'Architecture', 'ARC'),
  ('a1000233-0000-4000-8000-000000000233', NULL, 'Banking and Finance', 'BFN'),
  ('a1000236-0000-4000-8000-000000000236', NULL, 'Chemical Engineering', 'CHE'),
  ('a1000237-0000-4000-8000-000000000237', NULL, 'Computer Engineering', 'CPE'),
  ('a1000247-0000-4000-8000-000000000247', NULL, 'Marketing', 'MKT'),
  ('a1000249-0000-4000-8000-000000000249', NULL, 'Pharmacy', 'PHM'),
  ('a1000251-0000-4000-8000-000000000251', NULL, 'Psychology', 'PSY'),
  ('a1000252-0000-4000-8000-000000000252', NULL, 'Public Administration', 'PAD'),
  ('a1000254-0000-4000-8000-000000000254', NULL, 'Sociology', 'SOC'),
  ('a1000255-0000-4000-8000-000000000255', NULL, 'Software Engineering', 'SWE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, institution_id = NULL;

-- Upsert university programmes bound to whatever UUID "university" has in THIS database
INSERT INTO public.programmes (id, institution_id, education_level_id, department_id, name, code, is_active)
SELECT v.id, NULL, el.id, v.department_id, v.name, v.code, true
FROM public.education_levels el
CROSS JOIN (
  VALUES
    ('a1000310-0000-4000-8000-000000000310'::uuid, 'a1000210-0000-4000-8000-000000000210'::uuid, 'B.Sc. Computer Science', 'BSC-CSC'),
    ('a1000311-0000-4000-8000-000000000311'::uuid, 'a1000211-0000-4000-8000-000000000211'::uuid, 'B.Eng. Electrical / Electronic Engineering', 'BENG-EEE'),
    ('a1000312-0000-4000-8000-000000000312'::uuid, 'a1000212-0000-4000-8000-000000000212'::uuid, 'B.Eng. Mechanical Engineering', 'BENG-MEE'),
    ('a1000313-0000-4000-8000-000000000313'::uuid, 'a1000213-0000-4000-8000-000000000213'::uuid, 'B.Eng. Civil Engineering', 'BENG-CVE'),
    ('a1000314-0000-4000-8000-000000000314'::uuid, 'a1000214-0000-4000-8000-000000000214'::uuid, 'B.Sc. Mass Communication', 'BSC-MAC'),
    ('a1000315-0000-4000-8000-000000000315'::uuid, 'a1000215-0000-4000-8000-000000000215'::uuid, 'B.Sc. Accounting', 'BSC-ACC'),
    ('a1000316-0000-4000-8000-000000000316'::uuid, 'a1000216-0000-4000-8000-000000000216'::uuid, 'B.Sc. Business Administration', 'BSC-BUS'),
    ('a1000317-0000-4000-8000-000000000317'::uuid, 'a1000217-0000-4000-8000-000000000217'::uuid, 'B.Sc. Economics', 'BSC-ECO'),
    ('a1000318-0000-4000-8000-000000000318'::uuid, 'a1000218-0000-4000-8000-000000000218'::uuid, 'LL.B. Law', 'LLB'),
    ('a1000319-0000-4000-8000-000000000319'::uuid, 'a1000219-0000-4000-8000-000000000219'::uuid, 'MBBS Medicine and Surgery', 'MBBS'),
    ('a1000320-0000-4000-8000-000000000320'::uuid, 'a1000220-0000-4000-8000-000000000220'::uuid, 'B.NSc. Nursing Science', 'BNSC'),
    ('a1000321-0000-4000-8000-000000000321'::uuid, 'a1000221-0000-4000-8000-000000000221'::uuid, 'B.Sc. Microbiology', 'BSC-MCB'),
    ('a1000322-0000-4000-8000-000000000322'::uuid, 'a1000225-0000-4000-8000-000000000225'::uuid, 'B.Sc. Mathematics', 'BSC-MTH'),
    ('a1000323-0000-4000-8000-000000000323'::uuid, 'a1000228-0000-4000-8000-000000000228'::uuid, 'B.Ed. Education', 'BED'),
    ('a1000324-0000-4000-8000-000000000324'::uuid, 'a1000229-0000-4000-8000-000000000229'::uuid, 'General Studies / Undeclared', 'GNS'),
    ('a1000350-0000-4000-8000-000000000350'::uuid, 'a1000232-0000-4000-8000-000000000232'::uuid, 'B.Sc. Architecture', 'BSC-ARC'),
    ('a1000351-0000-4000-8000-000000000351'::uuid, 'a1000233-0000-4000-8000-000000000233'::uuid, 'B.Sc. Banking and Finance', 'BSC-BFN'),
    ('a1000352-0000-4000-8000-000000000352'::uuid, 'a1000236-0000-4000-8000-000000000236'::uuid, 'B.Eng. Chemical Engineering', 'BENG-CHE'),
    ('a1000353-0000-4000-8000-000000000353'::uuid, 'a1000237-0000-4000-8000-000000000237'::uuid, 'B.Eng. Computer Engineering', 'BENG-CPE'),
    ('a1000354-0000-4000-8000-000000000354'::uuid, 'a1000255-0000-4000-8000-000000000255'::uuid, 'B.Sc. Software Engineering', 'BSC-SWE'),
    ('a1000355-0000-4000-8000-000000000355'::uuid, 'a1000247-0000-4000-8000-000000000247'::uuid, 'B.Sc. Marketing', 'BSC-MKT'),
    ('a1000356-0000-4000-8000-000000000356'::uuid, 'a1000252-0000-4000-8000-000000000252'::uuid, 'B.Sc. Public Administration', 'BSC-PAD'),
    ('a1000358-0000-4000-8000-000000000358'::uuid, 'a1000251-0000-4000-8000-000000000251'::uuid, 'B.Sc. Psychology', 'BSC-PSY'),
    ('a1000359-0000-4000-8000-000000000359'::uuid, 'a1000254-0000-4000-8000-000000000254'::uuid, 'B.Sc. Sociology', 'BSC-SOC'),
    ('a1000360-0000-4000-8000-000000000360'::uuid, 'a1000249-0000-4000-8000-000000000249'::uuid, 'Doctor of Pharmacy (Pharm.D)', 'PHARM-D'),
    ('a1000373-0000-4000-8000-000000000373'::uuid, 'a1000221-0000-4000-8000-000000000221'::uuid, 'B.Sc. Biochemistry', 'BSC-BCH'),
    ('a1000374-0000-4000-8000-000000000374'::uuid, 'a1000226-0000-4000-8000-000000000226'::uuid, 'B.Sc. Physics', 'BSC-PHY'),
    ('a1000375-0000-4000-8000-000000000375'::uuid, 'a1000227-0000-4000-8000-000000000227'::uuid, 'B.Sc. Chemistry', 'BSC-CHM'),
    ('a1000376-0000-4000-8000-000000000376'::uuid, 'a1000223-0000-4000-8000-000000000223'::uuid, 'B.Sc. Political Science', 'BSC-POL'),
    ('a1000377-0000-4000-8000-000000000377'::uuid, 'a1000224-0000-4000-8000-000000000224'::uuid, 'B.A. English and Literary Studies', 'BA-ENG')
) AS v(id, department_id, name, code)
WHERE el.code = 'university'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  is_active = true,
  institution_id = NULL,
  education_level_id = EXCLUDED.education_level_id,
  department_id = EXCLUDED.department_id;

-- Polytechnic programmes
INSERT INTO public.programmes (id, institution_id, education_level_id, department_id, name, code, is_active)
SELECT v.id, NULL, el.id, v.department_id, v.name, v.code, true
FROM public.education_levels el
CROSS JOIN (
  VALUES
    ('a1000330-0000-4000-8000-000000000330'::uuid, 'a1000210-0000-4000-8000-000000000210'::uuid, 'ND Computer Science', 'ND-CSC'),
    ('a1000331-0000-4000-8000-000000000331'::uuid, 'a1000210-0000-4000-8000-000000000210'::uuid, 'HND Computer Science', 'HND-CSC'),
    ('a1000332-0000-4000-8000-000000000332'::uuid, 'a1000216-0000-4000-8000-000000000216'::uuid, 'ND Business Administration', 'ND-BUS'),
    ('a1000379-0000-4000-8000-000000000379'::uuid, 'a1000215-0000-4000-8000-000000000215'::uuid, 'ND Accountancy', 'ND-ACC'),
    ('a1000380-0000-4000-8000-000000000380'::uuid, 'a1000214-0000-4000-8000-000000000214'::uuid, 'ND Mass Communication', 'ND-MAC')
) AS v(id, department_id, name, code)
WHERE el.code = 'polytechnic'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  is_active = true,
  institution_id = NULL,
  education_level_id = EXCLUDED.education_level_id,
  department_id = EXCLUDED.department_id;

-- College of education
INSERT INTO public.programmes (id, institution_id, education_level_id, department_id, name, code, is_active)
SELECT v.id, NULL, el.id, v.department_id, v.name, v.code, true
FROM public.education_levels el
CROSS JOIN (
  VALUES
    ('a1000340-0000-4000-8000-000000000340'::uuid, 'a1000228-0000-4000-8000-000000000228'::uuid, 'NCE Mathematics / Education', 'NCE-MTH'),
    ('a1000341-0000-4000-8000-000000000341'::uuid, 'a1000228-0000-4000-8000-000000000228'::uuid, 'NCE English / Education', 'NCE-ENG')
) AS v(id, department_id, name, code)
WHERE el.code = 'college_of_education'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  is_active = true,
  institution_id = NULL,
  education_level_id = EXCLUDED.education_level_id,
  department_id = EXCLUDED.department_id;

-- Sanity: how many shared programmes now?
-- SELECT el.code, count(*) FROM programmes p JOIN education_levels el ON el.id = p.education_level_id
-- WHERE p.institution_id IS NULL GROUP BY 1;
