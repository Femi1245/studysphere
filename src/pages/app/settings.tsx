import {
  BookOpen,
  FileText,
  GraduationCap,
  Layers,
  LogOut,
  Shield,
  Timer,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/hooks/use-theme'
import { trySupabase } from '@/lib/supabase/client'
import type { EducationLevel, LearningStyle } from '@/types/database'

const secondaryLinks = [
  { to: '/app/notes', label: 'Notes', icon: FileText },
  { to: '/app/quizzes', label: 'Quizzes', icon: GraduationCap },
  { to: '/app/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/app/progress', label: 'Progress', icon: TrendingUp },
  { to: '/app/timer', label: 'Focus Timer', icon: Timer },
  { to: '/app/subjects', label: 'Subjects', icon: BookOpen },
] as const

export function SettingsPage() {
  const { user, profile, preferences, refreshProfile, signOut, updatePassword } = useAuth()
  const { setTheme } = useTheme()
  const { toast } = useToast()
  const navigate = useNavigate()
  const supabase = trySupabase()

  const [displayName, setDisplayName] = useState('')
  const [school, setSchool] = useState('')
  const [examGoals, setExamGoals] = useState('')
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('high_school')
  const [learningStyle, setLearningStyle] = useState<LearningStyle | ''>('')
  const [theme, setThemePref] = useState<'light' | 'dark' | 'system'>('system')
  const [notifyTasks, setNotifyTasks] = useState(true)
  const [notifyExams, setNotifyExams] = useState(true)
  const [notifyRevision, setNotifyRevision] = useState(true)
  const [notifyGoals, setNotifyGoals] = useState(true)
  const [focusMinutes, setFocusMinutes] = useState('25')
  const [breakMinutes, setBreakMinutes] = useState('5')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setSchool(profile.school ?? '')
      setExamGoals(profile.exam_goals ?? '')
      setEducationLevel(profile.education_level ?? 'high_school')
      setLearningStyle(profile.learning_style ?? '')
    }
    if (preferences) {
      setThemePref(preferences.theme)
      setNotifyTasks(preferences.notify_tasks)
      setNotifyExams(preferences.notify_exams)
      setNotifyRevision(preferences.notify_revision)
      setNotifyGoals(preferences.notify_goals)
      setFocusMinutes(String(preferences.focus_minutes))
      setBreakMinutes(String(preferences.break_minutes))
    }
  }, [profile, preferences])

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !user) return
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        school: school.trim() || null,
        exam_goals: examGoals.trim() || null,
        education_level: educationLevel,
        learning_style: learningStyle || null,
      })
      .eq('id', user.id)
    if (error) toast({ title: 'Save failed', description: error.message, kind: 'error' })
    else {
      await refreshProfile()
      toast({ title: 'Profile saved', kind: 'success' })
    }
  }

  const savePreferences = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !user) return
    setTheme(theme)
    const payload = {
      theme,
      notify_tasks: notifyTasks,
      notify_exams: notifyExams,
      notify_revision: notifyRevision,
      notify_goals: notifyGoals,
      focus_minutes: Number.parseInt(focusMinutes, 10) || 25,
      break_minutes: Number.parseInt(breakMinutes, 10) || 5,
    }
    const { error } = await supabase.from('user_preferences').upsert({
      user_id: user.id,
      ...payload,
    })
    if (error) toast({ title: 'Save failed', description: error.message, kind: 'error' })
    else {
      await refreshProfile()
      toast({ title: 'Preferences saved', kind: 'success' })
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', kind: 'error' })
      return
    }
    const { error } = await updatePassword(newPassword)
    if (error) toast({ title: 'Update failed', description: error, kind: 'error' })
    else {
      setNewPassword('')
      toast({ title: 'Password updated', kind: 'success' })
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (!supabase) return <SupabaseSetupBanner />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="rounded-2xl lg:hidden">
        <CardHeader>
          <CardTitle className="text-base">More tools</CardTitle>
          <CardDescription>Quick links from mobile profile</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {secondaryLinks.map(({ to, label, icon: Icon }) => (
            <Button key={to} asChild variant="outline" size="sm" className="justify-start">
              <Link to={to}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {profile?.role === 'admin' ? (
        <Button asChild variant="accent">
          <Link to="/app/admin">
            <Shield className="h-4 w-4" />
            Admin panel
          </Link>
        </Button>
      ) : null}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void saveProfile(e)} className="space-y-3">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Education level</Label>
              <Select value={educationLevel} onValueChange={(v) => setEducationLevel(v as EducationLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="middle_school">Middle school</SelectItem>
                  <SelectItem value="high_school">High school</SelectItem>
                  <SelectItem value="undergraduate">Undergraduate</SelectItem>
                  <SelectItem value="graduate">Graduate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>School</Label>
              <Input value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Exam goals</Label>
              <Input value={examGoals} onChange={(e) => setExamGoals(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Learning style</Label>
              <Select
                value={learningStyle || 'none'}
                onValueChange={(v) => setLearningStyle(v === 'none' ? '' : (v as LearningStyle))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="visual">Visual</SelectItem>
                  <SelectItem value="auditory">Auditory</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="kinesthetic">Kinesthetic</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Save profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void savePreferences(e)} className="space-y-3">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={(v) => setThemePref(v as typeof theme)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifyTasks} onChange={(e) => setNotifyTasks(e.target.checked)} />
              Task reminders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifyExams} onChange={(e) => setNotifyExams(e.target.checked)} />
              Exam reminders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifyRevision} onChange={(e) => setNotifyRevision(e.target.checked)} />
              Revision reminders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifyGoals} onChange={(e) => setNotifyGoals(e.target.checked)} />
              Goal reminders
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Focus (min)</Label>
                <Input type="number" value={focusMinutes} onChange={(e) => setFocusMinutes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Break (min)</Label>
                <Input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
              </div>
            </div>
            <Button type="submit">Save preferences</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void changePassword(e)} className="space-y-3">
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button type="submit" variant="outline">
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-2">
        {secondaryLinks.map(({ to, label, icon: Icon }) => (
          <Button key={to} asChild variant="outline" size="sm">
            <Link to={to}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </Button>
        ))}
      </div>

      <Button type="button" variant="danger" className="w-full" onClick={() => void handleSignOut()}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  )
}
