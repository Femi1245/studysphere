import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ACTIVE_QUIZ_STORAGE_KEY,
  type ActiveQuizSession,
} from '@/lib/quiz-timing'
import { useAuth } from '@/contexts/auth-context'

interface ActiveQuizContextValue {
  active: ActiveQuizSession | null
  startSession: (session: ActiveQuizSession) => void
  clearSession: () => void
  isLockedPath: (pathname: string) => boolean
}

const ActiveQuizContext = createContext<ActiveQuizContextValue | null>(null)

function readStored(userId: string | undefined): ActiveQuizSession | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_QUIZ_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveQuizSession
    if (userId && parsed.userId !== userId) return null
    if (new Date(parsed.endsAt).getTime() < Date.now() - 60_000) return null
    return parsed
  } catch {
    return null
  }
}

export function ActiveQuizProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [active, setActive] = useState<ActiveQuizSession | null>(() =>
    readStored(user?.id),
  )

  useEffect(() => {
    setActive(readStored(user?.id))
  }, [user?.id])

  const startSession = useCallback((session: ActiveQuizSession) => {
    sessionStorage.setItem(ACTIVE_QUIZ_STORAGE_KEY, JSON.stringify(session))
    setActive(session)
  }, [])

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(ACTIVE_QUIZ_STORAGE_KEY)
    setActive(null)
  }, [])

  const isLockedPath = useCallback(
    (pathname: string) => {
      if (!active) return false
      const allowed = `/app/quizzes/${active.quizId}/take`
      return pathname !== allowed
    },
    [active],
  )

  const value = useMemo(
    () => ({ active, startSession, clearSession, isLockedPath }),
    [active, startSession, clearSession, isLockedPath],
  )

  return (
    <ActiveQuizContext.Provider value={value}>{children}</ActiveQuizContext.Provider>
  )
}

export function useActiveQuiz() {
  const ctx = useContext(ActiveQuizContext)
  if (!ctx) throw new Error('useActiveQuiz must be used within ActiveQuizProvider')
  return ctx
}
