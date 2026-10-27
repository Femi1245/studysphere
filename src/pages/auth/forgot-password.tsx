import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'
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
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'

export function ForgotPasswordPage() {
  const { configured, resetPassword } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await resetPassword(email.trim())
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    toast({
      title: 'Check your email',
      description: 'If an account exists for that address, we sent a password reset link.',
      kind: 'success',
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <Logo className="mb-8" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Reset password</CardTitle>
          <CardDescription>
            Enter your email and we will send you a link to choose a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              Password reset requires Supabase configuration. Set{' '}
              <code className="text-xs">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> in your environment.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                disabled={!configured || submitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={!configured || submitting}>
              {submitting ? (
                <>
                  <Spinner className="h-4 w-4 border-white/30 border-t-white" />
                  Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>

          <Button variant="ghost" className="mt-4 w-full" asChild>
            <Link to="/login">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to sign in
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
