import { Pause, Play, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { logActivity } from '@/lib/activity'
import { trySupabase } from '@/lib/supabase/client'
import { formatSeconds } from '@/lib/utils'
import type { StudySession, Subject } from '@/types/database'

const STORAGE_KEY = 'studysphere_active_session'

type ActiveSession = {
  startedAt: number
  elapsedBeforePause: number
  running: boolean
  mode: 'focus' | 'break'
  subjectId: string | null
}

function loadSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ActiveSession
  } catch {
    return null
  }
}

function saveSession(s: ActiveSession | null) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  else localStorage.removeItem(STORAGE_KEY)
}

export function TimerPage() {
  const { user, preferences } = useAuth()
  const supabase = trySupabase()
  const focusMinutes = preferences?.focus_minutes ?? 25
  const breakMinutes = preferences?.break_minutes ?? 5
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [subjectId, setSubjectId] = useState<string>('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [recent, setRecent] = useState<StudySession[]>([])
  const tickRef = useRef<number | null>(null)
  const sessionStartRef = useRef<number | null>(null)

  const targetSeconds = (mode === 'focus' ? focusMinutes : breakMinutes) * 60

  const persist = useCallback(
    (patch: Partial<ActiveSession> & { running: boolean }) => {
      const base = loadSession() ?? {
        startedAt: Date.now(),
        elapsedBeforePause: 0,
        running: false,
        mode,
        subjectId: subjectId || null,
      }
      const next: ActiveSession = { ...base, ...patch, mode, subjectId: subjectId || null }
      saveSession(next)
    },
    [mode, subjectId],
  )

  useEffect(() => {
    if (!supabase || !user) return
    void supabase.from('subjects').select('*').eq('user_id', user.id).then(({ data }) => {
      setSubjects((data as Subject[]) ?? [])
    })
    void supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setRecent((data as StudySession[]) ?? []))
  }, [supabase, user])

  useEffect(() => {
    const saved = loadSession()
    if (saved) {
      setMode(saved.mode)
      setSubjectId(saved.subjectId ?? '')
      sessionStartRef.current = saved.startedAt
      if (saved.running) {
        const extra = Math.floor((Date.now() - saved.startedAt) / 1000)
        setElapsed(saved.elapsedBeforePause + extra)
        setRunning(true)
      } else {
        setElapsed(saved.elapsedBeforePause)
      }
    }
  }, [])

  useEffect(() => {
    if (!running) {
      if (tickRef.current) window.clearInterval(tickRef.current)
      return
    }
    tickRef.current = window.setInterval(() => {
      setElapsed((e) => e + 1)
    }, 1000)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [running])

  const start = () => {
    const now = Date.now()
    sessionStartRef.current = now
    setRunning(true)
    persist({ startedAt: now, elapsedBeforePause: elapsed, running: true })
  }

  const pause = () => {
    setRunning(false)
    persist({ elapsedBeforePause: elapsed, running: false, startedAt: Date.now() })
  }

  const stop = async () => {
    setRunning(false)
    saveSession(null)
    if (!supabase || !user || mode !== 'focus' || elapsed < 60) {
      setElapsed(0)
      return
    }
    const started = sessionStartRef.current ?? Date.now() - elapsed * 1000
    await supabase.from('study_sessions').insert({
      user_id: user.id,
      subject_id: subjectId || null,
      started_at: new Date(started).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: elapsed,
    })
    void logActivity(supabase, {
      userId: user.id,
      eventType: 'focus_session_completed',
      subjectId: subjectId || null,
      metadata: { duration_seconds: elapsed },
    })
    const { data } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(10)
    setRecent((data as StudySession[]) ?? [])
    setElapsed(0)
    sessionStartRef.current = null
  }

  const remaining = Math.max(0, targetSeconds - elapsed)

  if (!supabase) return <SupabaseSetupBanner />

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-center font-display text-2xl">
            {mode === 'focus' ? 'Focus' : 'Break'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="font-mono text-5xl font-bold text-primary-600">
            {formatSeconds(remaining)}
          </p>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant={mode === 'focus' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('focus')}
            >
              Focus ({focusMinutes}m)
            </Button>
            <Button
              type="button"
              variant={mode === 'break' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('break')}
            >
              Break ({breakMinutes}m)
            </Button>
          </div>
          <Select value={subjectId || 'none'} onValueChange={(v) => setSubjectId(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Subject (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No subject</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-center gap-2">
            {running ? (
              <Button variant="outline" onClick={pause}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            ) : elapsed > 0 ? (
              <Button onClick={start}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button onClick={start}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            )}
            <Button variant="danger" onClick={() => void stop()}>
              <Square className="h-4 w-4" />
              Stop & save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-muted">Complete a focus session to see history.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recent.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span>{formatSeconds(s.duration_seconds)}</span>
                  <span className="text-ink-muted">
                    {new Date(s.started_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
