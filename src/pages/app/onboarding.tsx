import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import type { EducationLevel, LearningStyle } from '@/types/database'

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('high_school')
  const [school, setSchool] = useState('')
  const [examGoals, setExamGoals] = useState('')
  const [preferredDuration, setPreferredDuration] = useState('25')
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [learningStyle, setLearningStyle] = useState<LearningStyle | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const supabase = trySupabase()
  if (!supabase) return <SupabaseSetupBanner />

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    setError(null)
    setSubmitting(true)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        education_level: educationLevel,
        school: school.trim() || null,
        exam_goals: examGoals.trim() || null,
        preferred_study_duration: Number.parseInt(preferredDuration, 10) || 25,
        timezone,
        learning_style: learningStyle || null,
        onboarding_completed: true,
      })
      .eq('id', user.id)

    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await refreshProfile()
    navigate('/app', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Set up your profile</CardTitle>
          <CardDescription>
            Tell us a bit about yourself so StudySphere can personalize your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Alex Student"
              />
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
              <Label htmlFor="school">School (optional)</Label>
              <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam_goals">Exam goals (optional)</Label>
              <Textarea
                id="exam_goals"
                value={examGoals}
                onChange={(e) => setExamGoals(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Preferred study session (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={180}
                value={preferredDuration}
                onChange={(e) => setPreferredDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Learning style (optional)</Label>
              <Select
                value={learningStyle || 'none'}
                onValueChange={(v) => setLearningStyle(v === 'none' ? '' : (v as LearningStyle))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="visual">Visual</SelectItem>
                  <SelectItem value="auditory">Auditory</SelectItem>
                  <SelectItem value="reading">Reading / writing</SelectItem>
                  <SelectItem value="kinesthetic">Kinesthetic</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving…' : 'Continue to dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
