import type { VercelRequest, VercelResponse } from '@vercel/node'

type Q = {
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  prompt: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
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
  const count = Math.min(Math.max(Number(body.count) || 0, 1), 100)
  const course = String(body.course || 'General studies').slice(0, 200)
  const difficulty = body.difficulty || 'medium'

  const prompt = `Generate exactly ${count} exam questions for the course "${course}" at ${difficulty} difficulty for Nigerian students.
Return ONLY a JSON array (no markdown) of objects with keys:
question_type ("multiple_choice" | "true_false" | "short_answer"),
prompt (string),
options (string array of 4 for multiple_choice, null otherwise),
correct_answer (exact option text or True/False or short string),
explanation (short string).
Prefer multiple_choice. Do not invent official curriculum claim — educational practice questions only.`

  const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'You output only valid JSON arrays of quiz questions.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    }),
  })

  if (!aiRes.ok) {
    const t = await aiRes.text()
    return res.status(502).json({ error: 'AI provider error', detail: t.slice(0, 200) })
  }

  const completion = (await aiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  let text = completion.choices?.[0]?.message?.content?.trim() ?? '[]'
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1]!.trim()
  let questions: Q[] = []
  try {
    questions = JSON.parse(text) as Q[]
  } catch {
    return res.status(502).json({ error: 'Could not parse generated questions' })
  }

  const cleaned = questions
    .filter((q) => q?.prompt && q?.correct_answer)
    .slice(0, count)
    .map((q) => ({
      question_type: q.question_type || 'multiple_choice',
      prompt: String(q.prompt),
      options: Array.isArray(q.options) ? q.options.map(String) : null,
      correct_answer: String(q.correct_answer),
      explanation: q.explanation ? String(q.explanation) : 'AI-generated practice item — verify with your materials.',
    }))

  return res.status(200).json({ questions: cleaned, ai_generated: true })
}
