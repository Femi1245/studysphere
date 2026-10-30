import type { VercelRequest, VercelResponse } from '@vercel/node'

type Q = {
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  prompt: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
}

function buildFallback(course: string, count: number, difficulty: string): Q[] {
  const subject = course.trim() || 'General studies'
  const out: Q[] = []
  for (let i = 1; i <= count; i += 1) {
    const options = [
      `Core concept ${i}A in ${subject}`,
      `Core concept ${i}B in ${subject}`,
      `Core concept ${i}C in ${subject}`,
      `Core concept ${i}D in ${subject}`,
    ]
    out.push({
      question_type: 'multiple_choice',
      prompt: `(${difficulty}) Practice item ${i} for ${subject}: which option best matches a foundational idea students should revise?`,
      options,
      correct_answer: options[i % 4]!,
      explanation:
        'Practice fallback item. AI generation was unavailable. Retry later for richer questions.',
    })
  }
  return out
}

function parseQuestions(text: string, count: number): Q[] {
  let cleaned = text.trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) cleaned = fence[1]!.trim()

  let raw: unknown
  try {
    raw = JSON.parse(cleaned)
  } catch {
    const objStart = cleaned.indexOf('{')
    const arrStart = cleaned.indexOf('[')
    let start = -1
    let end = -1
    if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
      start = objStart
      end = cleaned.lastIndexOf('}')
    } else if (arrStart >= 0) {
      start = arrStart
      end = cleaned.lastIndexOf(']')
    }
    if (start < 0 || end <= start) throw new Error('No JSON found in AI response')
    raw = JSON.parse(
      cleaned
        .slice(start, end + 1)
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u201C\u201D]/g, '"'),
    )
  }

  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { questions?: unknown[] }).questions)
      ? (raw as { questions: unknown[] }).questions
      : []

  const out: Q[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const q = item as Record<string, unknown>
    const prompt = String(q.prompt ?? q.question ?? '').trim()
    const correct = String(q.correct_answer ?? q.answer ?? q.correct ?? '').trim()
    if (!prompt || !correct) continue
    const optionsRaw = q.options ?? q.choices ?? null
    const options = Array.isArray(optionsRaw)
      ? optionsRaw.map(String)
      : optionsRaw && typeof optionsRaw === 'object'
        ? Object.values(optionsRaw as Record<string, string>).map(String)
        : null
    const t = String(q.question_type ?? q.type ?? 'multiple_choice').toLowerCase()
    out.push({
      question_type: t.includes('true')
        ? 'true_false'
        : t.includes('short')
          ? 'short_answer'
          : 'multiple_choice',
      prompt,
      options,
      correct_answer: correct,
      explanation: q.explanation
        ? String(q.explanation)
        : 'AI-generated practice item. Verify with your materials.',
    })
    if (out.length >= count) break
  }
  return out
}

/**
 * Same style as api/ai-tutor.ts — self-contained, @vercel/node typed handler.
 * Do not import local ./lib modules (those crash or break the Vite build chain).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rawBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  const body = rawBody as { count?: number; course?: string; difficulty?: string }
  const count = Math.min(Math.max(Number(body.count) || 10, 1), 30)
  const course = String(body.course || 'General studies').slice(0, 200)
  const difficulty = String(body.difficulty || 'medium')

  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(200).json({
      questions: buildFallback(course, count, difficulty),
      ai_generated: false,
      fallback: true,
      warning: 'GROQ_API_KEY not set on Vercel — using practice fallback questions',
    })
  }

  // Keep in sync with models available on Groq (invalid IDs return 404 and force fallback)
  const models = [
    ...new Set([
      process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      'openai/gpt-oss-20b',
      'llama-3.3-70b-versatile',
    ]),
  ]

  let lastError = ''
  for (const model of models) {
    for (const tryCount of [count, Math.min(count, 8), 5]) {
      try {
        const prompt = `Create ${tryCount} exam practice questions for Nigerian students on: "${course}" (${difficulty} difficulty).
Return ONLY valid JSON:
{"questions":[{"question_type":"multiple_choice","prompt":"...","options":["A","B","C","D"],"correct_answer":"exact option text","explanation":"..."}]}
Prefer multiple_choice with 4 options. correct_answer must match one option. No markdown.`

        const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are a quiz generator. Respond with JSON only.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        })

        if (!aiRes.ok) {
          lastError = `Groq ${aiRes.status}: ${(await aiRes.text()).slice(0, 160)}`
          continue
        }

        const completion = (await aiRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const text = completion.choices?.[0]?.message?.content?.trim() ?? ''
        const questions = parseQuestions(text, tryCount)
        if (!questions.length) {
          lastError = 'Parsed zero questions'
          continue
        }

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

  return res.status(200).json({
    questions: buildFallback(course, count, difficulty),
    ai_generated: false,
    fallback: true,
    warning: lastError || 'AI failed — using practice fallback questions',
  })
}
