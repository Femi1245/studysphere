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
        'Practice fallback item. AI generation was unavailable — retry later for richer questions.',
    })
  }
  return out
}

function stripFences(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fence?.[1] ?? text).trim()
}

function parseQuestions(text: string, count: number): Q[] {
  const cleaned = stripFences(text).replace(/^\uFEFF/, '').trim()
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
    if (start < 0 || end <= start) throw new Error('No JSON found')
    const slice = cleaned
      .slice(start, end + 1)
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[“”]/g, '"')
    raw = JSON.parse(slice)
  }

  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { questions?: unknown[] }).questions)
      ? ((raw as { questions: unknown[] }).questions)
      : []

  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const q = item as Record<string, unknown>
      const prompt = String(q.prompt ?? q.question ?? '').trim()
      const correct = String(q.correct_answer ?? q.answer ?? q.correct ?? '').trim()
      if (!prompt || !correct) return null
      const optionsRaw = q.options ?? q.choices ?? null
      const options = Array.isArray(optionsRaw)
        ? optionsRaw.map(String)
        : optionsRaw && typeof optionsRaw === 'object'
          ? Object.values(optionsRaw as Record<string, string>).map(String)
          : null
      const t = String(q.question_type ?? q.type ?? 'multiple_choice').toLowerCase()
      const question_type: Q['question_type'] = t.includes('true')
        ? 'true_false'
        : t.includes('short')
          ? 'short_answer'
          : 'multiple_choice'
      return {
        question_type,
        prompt,
        options,
        correct_answer: correct,
        explanation: q.explanation
          ? String(q.explanation)
          : 'AI-generated practice item — verify with your materials.',
      } satisfies Q
    })
    .filter(Boolean)
    .slice(0, count) as Q[]
}

async function callGroq(
  apiKey: string,
  model: string,
  count: number,
  course: string,
  difficulty: string,
): Promise<string> {
  const prompt = `Create ${count} exam practice questions for Nigerian students on: "${course}" (${difficulty} difficulty).
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
    throw new Error(`Groq ${aiRes.status}: ${(await aiRes.text()).slice(0, 160)}`)
  }
  const completion = (await aiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return completion.choices?.[0]?.message?.content?.trim() ?? ''
}

function readBody(req: VercelRequest): { count: number; course: string; difficulty: string } {
  const raw = req.body
  const body =
    typeof raw === 'string'
      ? (JSON.parse(raw || '{}') as Record<string, unknown>)
      : ((raw ?? {}) as Record<string, unknown>)
  return {
    count: Math.min(Math.max(Number(body.count) || 10, 1), 30),
    course: String(body.course || 'General studies').slice(0, 200),
    difficulty: String(body.difficulty || 'medium'),
  }
}

/**
 * Vercel serverless quiz generator.
 * Keep this file self-contained (no local ./lib imports) — those were crashing
 * FUNCTION_INVOCATION_FAILED on Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let course = 'General studies'
  let count = 10
  let difficulty = 'medium'

  try {
    ;({ course, count, difficulty } = readBody(req))

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

    const models = [
      process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
    ]
    const uniqueModels = [...new Set(models)]
    let lastError = ''

    for (const model of uniqueModels) {
      for (const tryCount of [count, Math.min(count, 8), 5]) {
        try {
          const text = await callGroq(apiKey, model, tryCount, course, difficulty)
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
  } catch (e) {
    return res.status(200).json({
      questions: buildFallback(course, count, difficulty),
      ai_generated: false,
      fallback: true,
      warning: e instanceof Error ? e.message : 'Generate failed',
    })
  }
}
