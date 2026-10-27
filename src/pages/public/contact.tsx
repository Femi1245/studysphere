import { Mail, MessageSquare } from 'lucide-react'
import { useState, type FormEvent } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { brand } from '@/config/brand'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'

export function ContactPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState(user?.email ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)

    const supabase = trySupabase()
    if (supabase) {
      const { error } = await supabase.from('support_requests').insert({
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        user_id: user?.id ?? null,
        status: 'open',
      })

      setSubmitting(false)
      if (error) {
        toast({
          title: 'Could not send message',
          description: error.message,
          kind: 'error',
        })
        return
      }

      toast({
        title: 'Message sent',
        description: 'We will get back to you as soon as we can.',
        kind: 'success',
      })
      setSubject('')
      setMessage('')
      if (!user) setEmail('')
      return
    }

    const body = encodeURIComponent(
      `${message.trim()}\n\n—\nFrom: ${email.trim()}\nSubject: ${subject.trim()}`,
    )
    const mailSubject = encodeURIComponent(subject.trim() || `${brand.name} support`)
    window.location.href = `mailto:${brand.supportEmail}?subject=${mailSubject}&body=${body}`
    setSubmitting(false)
    toast({
      title: 'Opening your email app',
      description: 'Send the message from your mail client to reach our team.',
      kind: 'default',
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Contact</h1>
        <p className="mt-4 text-lg text-ink-muted">
          Questions, feedback, or support—we are here to help.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <Mail className="h-8 w-8 text-primary-600" aria-hidden />
              <CardTitle className="text-lg">Email</CardTitle>
              <CardDescription>
                Prefer email? Reach us at{' '}
                <a
                  href={`mailto:${brand.supportEmail}`}
                  className="font-medium text-accent-600 hover:underline"
                >
                  {brand.supportEmail}
                </a>
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-accent-600" aria-hidden />
              <CardTitle className="text-lg">Response time</CardTitle>
              <CardDescription>
                We typically reply within a few business days. Include your subject or course name if
                relevant.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
            <CardDescription>
              Fill out the form below. If backend storage is not configured, your email app will open
              instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-subject">Subject</Label>
                <Input
                  id="contact-subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="How can we help?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us more..."
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? 'Sending…' : 'Send message'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
