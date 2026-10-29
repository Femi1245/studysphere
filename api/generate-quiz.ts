import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildFallbackQuizQuestions } from './lib/parse-quiz-questions'
import { generateQuizQuestionsCore } from './lib/generate-quiz-core'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      // Still allow exam start with local fallbacks when Groq is missing on the server
      const body = (req.body ?? {}) as { count?: number; course?: string; difficulty?: string }
      const count = Math.min(Math.max(Number(body.count) || 10, 1), 40)
      const course = String(body.course || 'General studies').slice(0, 200)
      const difficulty = body.difficulty || 'medium'
      return res.status(200).json({
        questions: buildFallbackQuizQuestions(course, count, difficulty),
        ai_generated: false,
        fallback: true,
        warning: 'GROQ_API_KEY not configured on server — using practice fallback questions',
      })
    }

    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Sign in required' })
    }

    const body = (req.body ?? {}) as { count?: number; course?: string; difficulty?: string }
    const count = Math.min(Math.max(Number(body.count) || 0, 1), 40)
    const course = String(body.course || 'General studies').slice(0, 200)
    const difficulty = body.difficulty || 'medium'

    const result = await generateQuizQuestionsCore({
      apiKey,
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      count,
      course,
      difficulty,
    })

    return res.status(200).json(result)
  } catch (e) {
    const body = (req.body ?? {}) as { count?: number; course?: string; difficulty?: string }
    const count = Math.min(Math.max(Number(body.count) || 10, 1), 40)
    const course = String(body.course || 'General studies').slice(0, 200)
    const difficulty = body.difficulty || 'medium'
    return res.status(200).json({
      questions: buildFallbackQuizQuestions(course, count, difficulty),
      ai_generated: false,
      fallback: true,
      warning: e instanceof Error ? e.message : 'Generate failed',
    })
  }
}
