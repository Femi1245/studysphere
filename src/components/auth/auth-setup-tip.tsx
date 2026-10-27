const AUTH_EMAIL_SETTINGS =
  'https://supabase.com/dashboard/project/rjyvsmncbragandzeowx/auth/providers'

/** Shown on auth screens so local sign-up avoids Supabase email rate limits. */
export function AuthSetupTip() {
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-medium">Avoid “email rate limit exceeded”</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
        Supabase’s free email sender only allows a few messages per hour. For local
        development, turn{' '}
        <strong>Confirm email</strong> <strong>OFF</strong> so sign-up does not send
        mail:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-amber-900/90 dark:text-amber-100/90">
        <li>
          Open{' '}
          <a
            href={AUTH_EMAIL_SETTINGS}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            Auth → Providers → Email
          </a>
        </li>
        <li>
          Disable <strong>Confirm email</strong> and save
        </li>
        <li>Wait 1–2 minutes, then sign up with a new email</li>
      </ol>
    </div>
  )
}
