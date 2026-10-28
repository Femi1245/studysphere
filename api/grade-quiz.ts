import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createUserClient, runGradeQuiz, type GradeQuizBody } from './lib/run-grade-quiz'

/**
 * Authoritative quiz grading. Never trust client-sent scores.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !anon) {
    return res.status(503).json({ error: 'Supabase not configured on server' })
  }

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const supabase = createUserClient(url, anon, auth)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const body = (req.body ?? {}) as GradeQuizBody
  const result = await runGradeQuiz(supabase, user.id, body)
  return res.status(result.status).json(result.json)
}
