/**
 * Vercel serverless quiz generator (ESM — package.json has "type": "module").
 * Set GROQ_API_KEY in Vercel project environment variables.
 */

function buildFallback(course, count, difficulty) {
  const subject = String(course || 'General studies').trim() || 'General studies'
  const n = Math.min(Math.max(Number(count) || 10, 1), 30)
  const diff = difficulty || 'medium'
  const out = []
  for (let i = 1; i <= n; i += 1) {
    const options = [
      'Core concept ' + i + 'A in ' + subject,
      'Core concept ' + i + 'B in ' + subject,
      'Core concept ' + i + 'C in ' + subject,
      'Core concept ' + i + 'D in ' + subject,
    ]
    out.push({
      question_type: 'multiple_choice',
      prompt:
        '(' +
        diff +
        ') Practice item ' +
        i +
        ' for ' +
        subject +
        ': which option best matches a foundational idea students should revise?',
      options,
      correct_answer: options[i % 4],
      explanation:
        'Practice fallback item. AI generation was unavailable. Retry later for richer questions.',
    })
  }
  return out
}

function parseQuestions(text, count) {
  let cleaned = String(text || '').trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) cleaned = fence[1].trim()

  let raw
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
    raw = JSON.parse(
      cleaned
        .slice(start, end + 1)
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u201C\u201D]/g, '"'),
    )
  }

  const list = Array.isArray(raw)
    ? raw
    : raw && Array.isArray(raw.questions)
      ? raw.questions
      : []

  const out = []
  for (let i = 0; i < list.length && out.length < count; i += 1) {
    const q = list[i]
    if (!q || typeof q !== 'object') continue
    const prompt = String(q.prompt || q.question || '').trim()
    const correct = String(q.correct_answer || q.answer || q.correct || '').trim()
    if (!prompt || !correct) continue
    let options = null
    if (Array.isArray(q.options)) options = q.options.map(String)
    else if (Array.isArray(q.choices)) options = q.choices.map(String)
    const t = String(q.question_type || q.type || 'multiple_choice').toLowerCase()
    out.push({
      question_type:
        t.indexOf('true') >= 0 ? 'true_false' : t.indexOf('short') >= 0 ? 'short_answer' : 'multiple_choice',
      prompt,
      options,
      correct_answer: correct,
      explanation: q.explanation
        ? String(q.explanation)
        : 'AI-generated practice item. Verify with your materials.',
    })
  }
  return out
}

async function callGroq(apiKey, model, count, course, difficulty) {
  const prompt =
    'Create ' +
    count +
    ' exam practice questions for Nigerian students on: "' +
    course +
    '" (' +
    difficulty +
    ' difficulty).\n' +
    'Return ONLY valid JSON:\n' +
    '{"questions":[{"question_type":"multiple_choice","prompt":"...","options":["A","B","C","D"],"correct_answer":"exact option text","explanation":"..."}]}\n' +
    'Prefer multiple_choice with 4 options. correct_answer must match one option. No markdown.'

  const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
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
    const t = await aiRes.text()
    throw new Error('Groq ' + aiRes.status + ': ' + String(t).slice(0, 160))
  }
  const completion = await aiRes.json()
  return String(
    completion?.choices?.[0]?.message?.content || '',
  ).trim()
}

function readBody(req) {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}')
    } catch {
      body = {}
    }
  }
  body = body || {}
  return {
    count: Math.min(Math.max(Number(body.count) || 10, 1), 30),
    course: String(body.course || 'General studies').slice(0, 200),
    difficulty: String(body.difficulty || 'medium'),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let course = 'General studies'
  let count = 10
  let difficulty = 'medium'

  try {
    ;({ course, count, difficulty } = readBody(req))

    const auth = req.headers.authorization || ''
    if (!String(auth).startsWith('Bearer ')) {
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

    const models = [process.env.GROQ_MODEL || 'llama-3.1-8b-instant', 'llama-3.1-8b-instant']
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
