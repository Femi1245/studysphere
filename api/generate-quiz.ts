import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildFallbackQuizQuestions,
  parseGeneratedQuizQuestions,
} from './lib/parse-quiz-questions'

async function callGroq(input: {
  apiKey: string
  model: string
  count: number
  course: string
  difficulty: string
}): Promise<string> {
  const { apiKey, model, count, course, difficulty } = input
  const prompt = `Create ${count} exam practice questions for Nigerian students on: "${course}" (${difficulty} difficulty).
Return ONLY valid JSON with this exact shape:
{"questions":[{"question_type":"multiple_choice","prompt":"...","options":["A","B","C","D"],"correct_answer":"exact option text","explanation":"..."}]}
Rules:
- Prefer multiple_choice with exactly 4 options
- correct_answer must match one option exactly
- No markdown, no extra commentary
- Educational practice only (not official exam claims)`

  const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a quiz generator. Respond with JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  })

  if (!aiRes.ok) {
    const t = await aiRes.text()
    throw new Error(`AI provider error: ${t.slice(0, 180)}`)
  }

  const completion = (await aiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return completion.choices?.[0]?.message?.content?.trim() ?? '{}'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'GROQ_API_KEY not configured' })
  }
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const body = req.body as { count?: number; course?: string; difficulty?: string }
  const count = Math.min(Math.max(Number(body.count) || 0, 1), 40)
  const course = String(body.course || 'General studies').slice(0, 200)
  const difficulty = body.difficulty || 'medium'
  const primary = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
  const fallbackModel = 'llama-3.1-8b-instant'

  const models = primary === fallbackModel ? [primary] : [primary, fallbackModel]
  let lastError = ''

  for (const model of models) {
    // Try full batch, then smaller batches if parse fails
    for (const tryCount of [count, Math.min(count, 10), Math.min(count, 5)]) {
      try {
        const text = await callGroq({
          apiKey,
          model,
          count: tryCount,
          course,
          difficulty,
        })
        const questions = parseGeneratedQuizQuestions(text, tryCount)
        if (!questions.length) throw new Error('Empty question list')

        // If we only got a partial batch but need more, keep what we have for this response;
        // client loops for remaining.
        return res.status(200).json({
          questions: questions.slice(0, count),
          ai_generated: true,
          model,
        })
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Generate failed'
      }
    }
  }

  // Last resort so the exam can still start
  const fallback = buildFallbackQuizQuestions(course, count, difficulty)
  return res.status(200).json({
    questions: fallback,
    ai_generated: false,
    fallback: true,
    warning: lastError || 'Could not parse generated questions',
  })
}
