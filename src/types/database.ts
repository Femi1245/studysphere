export type UserRole = 'student' | 'admin'

export type EducationLevel =
  | 'middle_school'
  | 'high_school'
  | 'undergraduate'
  | 'graduate'
  | 'other'

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
