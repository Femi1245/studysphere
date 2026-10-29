import {
  BookOpen,
  Camera,
  FileText,
  GraduationCap,
  Layers,
  LogOut,
  Shield,
  Timer,
  Trash2,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/hooks/use-theme'
import { removeAvatarFile, uploadAvatar } from '@/lib/avatar'
import { trySupabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { EducationLevel, LearningStyle } from '@/types/database'

const secondaryLinks = [
  { to: '/app/notes', label: 'Notes', icon: FileText },
  { to: '/app/quizzes', label: 'Quizzes', icon: GraduationCap },
  { to: '/app/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/app/progress', label: 'Progress', icon: TrendingUp },
  { to: '/app/timer', label: 'Focus Timer', icon: Timer },
  { to: '/app/subjects', label: 'Subjects', icon: BookOpen },
] as const

/**
 * Profile management — CRUD for profile fields + avatar + preferences.
 * Create: upsert empty profile if missing
 * Retrieve: load from auth context
 * Update: save form / avatar
 * Delete: clear profile data, remove avatar, or delete account
 */
export function SettingsPage() {
  const { user, profile, preferences, refreshProfile, signOut, updatePassword } = useAuth()
  const { setTheme } = useTheme()
  const { toast } = useToast()
  const navigate = useNavigate()
  const supabase = trySupabase()
  const fileRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [school, setSchool] = useState('')
  const [examGoals, setExamGoals] = useState('')
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('high_school')
  const [learningStyle, setLearningStyle] = useState<LearningStyle | ''>('')
  const [timezone, setTimezone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [theme, setThemePref] = useState<'light' | 'dark' | 'system'>('system')
  const [notifyTasks, setNotifyTasks] = useState(true)
  const [notifyExams, setNotifyExams] = useState(true)
  const [notifyRevision, setNotifyRevision] = useState(true)
  const [notifyGoals, setNotifyGoals] = useState(true)
  const [focusMinutes, setFocusMinutes] = useState('25')
  const [breakMinutes, setBreakMinutes] = useState('5')
  const [newPassword, setNewPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setSchool(profile.school ?? '')
      setExamGoals(profile.exam_goals ?? '')
      setEducationLevel(profile.education_level ?? 'high_school')
      setLearningStyle(profile.learning_style ?? '')
      setTimezone(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
      setAvatarUrl(profile.avatar_url)
    }
    if (preferences) {
      setThemePref(preferences.theme ?? 'system')
      setNotifyTasks(preferences.notify_tasks)
      setNotifyExams(preferences.notify_exams)
      setNotifyRevision(preferences.notify_revision)
      setNotifyGoals(preferences.notify_goals)
      setFocusMinutes(String(preferences.focus_minutes))
      setBreakMinutes(String(preferences.break_minutes))
    }
  }, [profile, preferences])

  /** CREATE — ensure profile + preferences rows exist */
  const ensureProfile = async () => {
    if (!supabase || !user) return { error: 'Not signed in' }
    const { error: pErr } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        display_name:
          displayName.trim() ||
          user.email?.split('@')[0] ||
          'Student',
        education_level: educationLevel,
      },
      { onConflict: 'id' },
    )
    if (pErr) return { error: pErr.message }
    const { error: prefErr } = await supabase.from('user_preferences').upsert(
      { user_id: user.id },
      { onConflict: 'user_id' },
    )
    if (prefErr) return { error: prefErr.message }
    await refreshProfile()
    return { error: null }
  }

  /** UPDATE profile */
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !user) return
    setSavingProfile(true)
    if (!profile) {
      const created = await ensureProfile()
      if (created.error) {
        toast({ title: 'Create failed', description: created.error, kind: 'error' })
        setSavingProfile(false)
        return
      }
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        school: school.trim() || null,
        exam_goals: examGoals.trim() || null,
        education_level: educationLevel,
        learning_style: learningStyle || null,
        timezone: timezone.trim() || null,
        avatar_url: avatarUrl,
      })
      .eq('id', user.id)
    setSavingProfile(false)
    if (error) toast({ title: 'Update failed', description: error.message, kind: 'error' })
    else {
      await refreshProfile()
      toast({ title: 'Profile updated', kind: 'success' })
    }
  }

  const onAvatarPick = async (file: File | null) => {
    if (!file || !supabase || !user) return
    setUploadingAvatar(true)
    const { url, error } = await uploadAvatar(supabase, user.id, file)
    if (error || !url) {
      setUploadingAvatar(false)
      toast({ title: 'Avatar upload failed', description: error ?? 'Unknown error', kind: 'error' })
      return
    }
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id)
    setUploadingAvatar(false)
    if (dbErr) {
      toast({ title: 'Could not save avatar', description: dbErr.message, kind: 'error' })
      return
    }
    setAvatarUrl(url)
    await refreshProfile()
    toast({ title: 'Avatar updated', kind: 'success' })
  }

  const deleteAvatar = async () => {
    if (!supabase || !user) return
    setUploadingAvatar(true)
    await removeAvatarFile(supabase, user.id)
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    setUploadingAvatar(false)
    if (error) {
      toast({ title: 'Remove failed', description: error.message, kind: 'error' })
      return
    }
    setAvatarUrl(null)
    await refreshProfile()
    toast({ title: 'Avatar removed', kind: 'success' })
  }

  /** DELETE — clear personal profile fields (keeps account) */
  const clearProfileData = async () => {
    if (!supabase || !user) return
    const ok = window.confirm(
      'Clear your profile details (name, school, goals, avatar)? Your account login will remain.',
    )
    if (!ok) return
    setDeleting(true)
    await removeAvatarFile(supabase, user.id)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: null,
        school: null,
        exam_goals: null,
        learning_style: null,
        avatar_url: null,
        preferred_study_duration: null,
      })
      .eq('id', user.id)
    setDeleting(false)
    if (error) toast({ title: 'Clear failed', description: error.message, kind: 'error' })
    else {
      setDisplayName('')
      setSchool('')
      setExamGoals('')
      setLearningStyle('')
      setAvatarUrl(null)
      await refreshProfile()
      toast({ title: 'Profile data cleared', kind: 'success' })
    }
  }

  /** DELETE account — removes auth user via RPC if available; otherwise signs out with warning */
  const deleteAccount = async () => {
    if (!supabase || !user) return
    const ok = window.confirm(
      'Permanently delete your StudySphere account and related data? This cannot be undone.',
    )
    if (!ok) return
    const typed = window.prompt('Type DELETE to confirm account deletion')
    if (typed !== 'DELETE') {
      toast({ title: 'Deletion cancelled', kind: 'error' })
      return
    }
    setDeleting(true)
    await removeAvatarFile(supabase, user.id)
    // Soft cleanup of academic profile & enrolments owned by user (RLS)
    await supabase.from('student_course_enrolments').delete().eq('user_id', user.id)
    await supabase.from('student_academic_profiles').delete().eq('user_id', user.id)
    await supabase.from('user_preferences').delete().eq('user_id', user.id)
    // Prefer Edge/RPC delete; fall back to clearing profile + sign out
    const { error: rpcErr } = await supabase.rpc('delete_own_account')
    if (rpcErr) {
      await supabase.from('profiles').delete().eq('id', user.id)
      toast({
        title: 'Account data removed',
        description:
          'Local study data cleared. Ask an admin to fully delete Auth user if login still works.',
        kind: 'success',
      })
    } else {
      toast({ title: 'Account deleted', kind: 'success' })
    }
    setDeleting(false)
    await signOut()
    navigate('/login', { replace: true })
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

  const initials =
    (displayName || user?.email || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'

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

      {/* Avatar + identity */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Avatar</CardTitle>
          <CardDescription>Upload a profile photo (JPEG/PNG/WebP/GIF, max 2 MB).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div
            className={cn(
              'relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-50 text-xl font-semibold text-primary-800 dark:bg-primary-900/40 dark:text-primary-100',
            )}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
            {uploadingAvatar ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Spinner className="h-6 w-6 border-white/40 border-t-white" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onAvatarPick(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploadingAvatar}
                onClick={() => void deleteAvatar()}
              >
                <Trash2 className="h-4 w-4" />
                Remove photo
              </Button>
            ) : null}
            <p className="text-xs text-ink-muted">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Profile CRUD */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Create / update your study identity. Academic institution &amp; courses are managed
            separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void saveProfile(e)} className="space-y-3">
            {!profile ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                No profile row yet.{' '}
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => void ensureProfile().then((r) => {
                    if (r.error) toast({ title: 'Create failed', description: r.error, kind: 'error' })
                    else toast({ title: 'Profile created', kind: 'success' })
                  })}
                >
                  Create profile
                </button>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Education level</Label>
              <Select
                value={educationLevel}
                onValueChange={(v) => setEducationLevel(v as EducationLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Label>School (short label)</Label>
              <Input value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Exam goals</Label>
              <Input value={examGoals} onChange={(e) => setExamGoals(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Africa/Lagos"
              />
            </div>
            <div className="space-y-2">
              <Label>Learning style</Label>
              <Select
                value={learningStyle || 'none'}
                onValueChange={(v) => setLearningStyle(v === 'none' ? '' : (v as LearningStyle))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button asChild variant="outline" type="button">
              <Link to="/app/academic-profile">
                <GraduationCap className="h-4 w-4" />
                Academic profile &amp; course enrolments
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? <Spinner className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                {profile ? 'Update profile' : 'Create & save profile'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={deleting || !profile}
                onClick={() => void clearProfileData()}
              >
                Clear profile fields
              </Button>
            </div>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyTasks}
                onChange={(e) => setNotifyTasks(e.target.checked)}
              />
              Task reminders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyExams}
                onChange={(e) => setNotifyExams(e.target.checked)}
              />
              Exam reminders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyRevision}
                onChange={(e) => setNotifyRevision(e.target.checked)}
              />
              Revision reminders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyGoals}
                onChange={(e) => setNotifyGoals(e.target.checked)}
              />
              Goal reminders
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Focus (min)</Label>
                <Input
                  type="number"
                  value={focusMinutes}
                  onChange={(e) => setFocusMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Break (min)</Label>
                <Input
                  type="number"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                />
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

      <Card className="rounded-2xl border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger">Danger zone</CardTitle>
          <CardDescription>Permanently remove your account and owned academic data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="danger"
            disabled={deleting}
            onClick={() => void deleteAccount()}
          >
            {deleting ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            Delete account
          </Button>
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

      <Button type="button" variant="outline" className="w-full" onClick={() => void handleSignOut()}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  )
}
