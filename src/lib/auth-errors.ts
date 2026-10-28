/** Map Supabase Auth errors to actionable UI messages. */
export function mapAuthError(message: string): string {
  const lower = message.toLowerCase()

  if (
    lower.includes('rate limit') ||
    lower.includes('email rate limit') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return (
      'Supabase blocked sign-up because it is still trying to send a confirmation email, ' +
      'and the free mailer is capped at ~2 emails/hour. ' +
      'In the Supabase dashboard: Auth → Providers → Email → turn Confirm email OFF → Save, ' +
      'then sign up with a new email. The tip on this page is only a reminder — the setting must be changed in Supabase.'
    )
  }

  if (lower.includes('email not confirmed') || lower.includes('confirm your email')) {
    return (
      'Please confirm your email before signing in, or turn off Authentication → Providers → Email → Confirm email for local testing.'
    )
  }

  if (lower.includes('invalid login credentials')) {
    return (
      'Invalid email or password. If you just signed up with Confirm email ON, confirm via email first — or disable Confirm email in Supabase and create a new account.'
    )
  }

  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }

  return message
}
