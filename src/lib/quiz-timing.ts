/** Allowed assessment question counts and matching time limits (minutes). */
export const QUIZ_QUESTION_COUNTS = [30, 60, 100, 300] as const
export type QuizQuestionCount = (typeof QUIZ_QUESTION_COUNTS)[number]

/** One minute per question — exam-style pacing. */
export function durationMinutesForCount(count: number): number {
  if (count >= 300) return 300
  if (count >= 100) return 100
  if (count >= 60) return 60
  return 30
}

export const MIN_QUIZ_QUESTIONS = 30

export const ACTIVE_QUIZ_STORAGE_KEY = 'studysphere-active-quiz'

export interface ActiveQuizSession {
  quizId: string
  attemptId: string
  userId: string
  endsAt: string
  startedAt: string
  questionCount: number
  passMark: number
  mode: 'practice' | 'assessment'
}
