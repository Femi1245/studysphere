export type UserRole = 'student' | 'admin'

export type EducationLevel =
  | 'middle_school'
  | 'high_school'
  | 'undergraduate'
  | 'graduate'
  | 'other'

/** Codes in `education_levels` catalogue table */
export type AcademicEducationLevelCode =
  | 'junior_secondary'
  | 'senior_secondary'
  | 'university'
  | 'polytechnic'
  | 'college_of_education'
  | 'other_tertiary'

export type InstitutionType =
  | 'secondary'
  | 'university'
  | 'polytechnic'
  | 'college_of_education'
  | 'other'

export type SemesterTerm = 'first' | 'second' | 'third'

export type CatalogueRequestType = 'institution' | 'programme' | 'course' | 'material'
export type CatalogueRequestStatus = 'open' | 'in_review' | 'resolved' | 'closed'

export type MaterialType =
  | 'lecture_notes'
  | 'study_guide'
  | 'definitions'
  | 'worked_examples'
  | 'practice'
  | 'revision_summary'
  | 'past_questions'
  | 'other'

export type LearningMaterialStatus = 'draft' | 'published' | 'unpublished'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'
export type QuizMode = 'practice' | 'assessment'

export type EnrolmentStatus = 'active' | 'completed' | 'dropped'

export type LearningStyle =
  | 'visual'
  | 'auditory'
  | 'reading'
  | 'kinesthetic'
  | 'mixed'

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'completed' | 'cancelled'
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer'

export interface Profile {
  id: string
  display_name: string | null
  education_level: EducationLevel | null
  school: string | null
  exam_goals: string | null
  preferred_study_duration: number | null
  timezone: string | null
  learning_style: LearningStyle | null
  onboarding_completed: boolean
  role: UserRole
  avatar_url: string | null
  country_id: string | null
  academic_profile_complete: boolean
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  user_id: string
  theme: 'light' | 'dark' | 'system'
  notify_tasks: boolean
  notify_exams: boolean
  notify_revision: boolean
  notify_goals: boolean
  focus_minutes: number
  break_minutes: number
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  user_id: string
  name: string
  color: string
  icon: string | null
  goal: string | null
  created_at: string
  updated_at: string
}

export interface Topic {
  id: string
  user_id: string
  subject_id: string
  parent_id: string | null
  name: string
  completed: boolean
  needs_revision: boolean
  created_at: string
  updated_at: string
}

export interface StudyTask {
  id: string
  user_id: string
  subject_id: string | null
  topic_id: string | null
  title: string
  description: string | null
  due_at: string | null
  scheduled_at: string | null
  priority: TaskPriority
  status: TaskStatus
  estimated_minutes: number | null
  is_exam: boolean
  is_revision: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface StudySession {
  id: string
  user_id: string
  subject_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number
  notes: string | null
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  subject_id: string | null
  topic_id: string | null
  title: string
  content: string
  pinned: boolean
  favorite: boolean
  created_at: string
  updated_at: string
}

export interface LearningResource {
  id: string
  user_id: string
  note_id: string | null
  subject_id: string | null
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  extracted_text: string | null
  created_at: string
}

export interface Quiz {
  id: string
  user_id: string
  subject_id: string | null
  topic_id: string | null
  title: string
  description: string | null
  duration_minutes: number | null
  catalogue_course_id: string | null
  bank_id: string | null
  difficulty: QuestionDifficulty | null
  pass_mark: number
  mode: QuizMode
  question_count: number | null
  is_timed: boolean
  randomized: boolean
  created_at: string
  updated_at: string
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  user_id: string
  question_type: QuestionType
  prompt: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  order_index: number
  topic_label: string | null
  bank_question_id: string | null
  source_fingerprint: string | null
  created_at: string
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  user_id: string
  score: number
  max_score: number
  started_at: string
  submitted_at: string | null
  created_at: string
}

export interface QuizAnswer {
  id: string
  attempt_id: string
  question_id: string
  user_id: string
  answer: string
  is_correct: boolean | null
  created_at: string
}

export interface FlashcardDeck {
  id: string
  user_id: string
  subject_id: string | null
  topic_id: string | null
  title: string
  created_at: string
  updated_at: string
}

export interface Flashcard {
  id: string
  deck_id: string
  user_id: string
  front: string
  back: string
  ease_factor: number
  interval_days: number
  repetitions: number
  next_review_at: string
  created_at: string
  updated_at: string
}

export interface FlashcardReview {
  id: string
  flashcard_id: string
  user_id: string
  quality: number
  reviewed_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  read: boolean
  link: string | null
  created_at: string
}

export interface SupportRequest {
  id: string
  user_id: string | null
  email: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  updated_at: string
}

export interface AiConversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface AiMessage {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface Country {
  id: string
  code: string
  name: string
  created_at: string
}

export interface EducationLevelRow {
  id: string
  code: AcademicEducationLevelCode
  label: string
  sort_order: number
}

export interface Institution {
  id: string
  country_id: string
  name: string
  institution_type: InstitutionType
  state_region: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClassLevel {
  id: string
  education_level_id: string
  code: string
  label: string
  sort_order: number
}

export interface Department {
  id: string
  institution_id: string | null
  name: string
  code: string | null
}

export interface Programme {
  id: string
  institution_id: string | null
  education_level_id: string
  department_id: string | null
  name: string
  code: string | null
  is_active: boolean
}

export interface AcademicSession {
  id: string
  label: string
  starts_on: string | null
  ends_on: string | null
  is_current: boolean
}

export interface CatalogueCourse {
  id: string
  institution_id: string | null
  programme_id: string | null
  education_level_id: string
  class_level_id: string | null
  department_id: string | null
  code: string
  title: string
  semester_term: SemesterTerm | null
  description: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface StudentAcademicProfile {
  user_id: string
  country_id: string
  institution_id: string | null
  education_level_id: string
  programme_id: string | null
  department_id: string | null
  class_level_id: string | null
  academic_session_id: string | null
  semester_term: SemesterTerm | null
  course_of_study: string | null
  custom_institution_name: string | null
  custom_programme_name: string | null
  created_at: string
  updated_at: string
}

export interface StudentCourseEnrolment {
  id: string
  user_id: string
  catalogue_course_id: string
  subject_id: string | null
  status: EnrolmentStatus
  enrolled_at: string
}

export type StudyBookKind = 'theory' | 'practical'
export type StudyBookStatus = 'not_started' | 'in_progress' | 'completed'

export interface CurriculumSubject {
  id: string
  programme_id: string | null
  education_level_id: string | null
  catalogue_course_id: string | null
  name: string
  code: string | null
  description: string | null
  order_index: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface RecommendedStudyBook {
  id: string
  catalogue_course_id: string | null
  programme_id: string | null
  curriculum_subject_id: string | null
  subject_label: string
  title: string
  author: string | null
  edition: string | null
  book_kind: StudyBookKind
  description: string | null
  is_published: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface StudentBookProgress {
  id: string
  user_id: string
  book_id: string
  status: StudyBookStatus
  progress_percent: number
  notes: string | null
  started_at: string | null
  completed_at: string | null
  last_studied_at: string
  created_at: string
  updated_at: string
}

export interface CatalogueRequest {
  id: string
  user_id: string
  request_type: CatalogueRequestType
  title: string
  details: string | null
  country_id: string | null
  education_level_id: string | null
  status: CatalogueRequestStatus
  created_at: string
  updated_at: string
}

export interface LearningMaterial {
  id: string
  catalogue_course_id: string
  topic_id: string | null
  title: string
  material_type: MaterialType
  content_html: string | null
  file_path: string | null
  file_type: string | null
  file_size: number | null
  extracted_text: string | null
  source_label: string | null
  is_ai_generated: boolean
  is_verified: boolean
  status: LearningMaterialStatus
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MaterialBookmark {
  id: string
  user_id: string
  material_id: string
  created_at: string
}

export interface MaterialAnnotation {
  id: string
  user_id: string
  material_id: string
  selected_text: string | null
  note: string
  anchor_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ReadingProgress {
  id: string
  user_id: string
  material_id: string
  progress_percent: number
  last_position: string | null
  completed: boolean
  last_read_at: string
}

export interface QuestionBank {
  id: string
  catalogue_course_id: string | null
  education_level_id: string | null
  title: string
  description: string | null
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BankQuestion {
  id: string
  bank_id: string
  topic_label: string | null
  difficulty: QuestionDifficulty
  question_type: QuestionType
  prompt: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  is_ai_generated: boolean
  is_verified: boolean
  order_index: number
  created_at: string
}

export interface ActivityEvent {
  id: string
  user_id: string
  event_type: string
  subject_id: string | null
  catalogue_course_id: string | null
  material_id: string | null
  quiz_id: string | null
  attempt_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface StudentRecommendation {
  id: string
  user_id: string
  title: string
  body: string
  action_href: string | null
  reason: string | null
  kind: string | null
  topic_key: string | null
  evidence_json: Record<string, unknown>
  dismissed: boolean
  created_at: string
  updated_at?: string
}

export interface TopicPerformance {
  id: string
  user_id: string
  topic_key: string
  catalogue_course_id: string | null
  incorrect_count: number
  correct_count: number
  distinct_attempts: number
  last_incorrect_at: string | null
  last_correct_at: string | null
  created_at: string
  updated_at: string
}

export interface PlatformSetting {
  key: string
  value: unknown
  updated_at: string
}
