/** Map Supabase Auth errors to actionable UI messages. */
export function mapAuthError(message: string): string {
  const lower = message.toLowerCase()

  if (
    lower.includes('rate limit') ||
    lower.includes('email rate limit') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return (
      'Email rate limit exceeded. Supabase’s free email provider allows only a few messages per hour. ' +
      'Fix: in the Supabase dashboard open Authentication → Providers → Email and turn Confirm email OFF, ' +
      'then wait a few minutes and try signing up again (no confirmation email will be sent).'
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
