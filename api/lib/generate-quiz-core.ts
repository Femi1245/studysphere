import {
  buildFallbackQuizQuestions,
  parseGeneratedQuizQuestions,
  type ParsedQuizQuestion,
} from './parse-quiz-questions.js'

const FALLBACK_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'] as const

async function callGroqOnce(input: {
  apiKey: string
  model: string
  count: number
  course: string
  difficulty: string
  useJsonObject: boolean
}): Promise<string> {
  const { apiKey, model, count, course, difficulty, useJsonObject } = input
  const prompt = useJsonObject
    ? `Create ${count} exam practice questions for Nigerian students on: "${course}" (${difficulty} difficulty).
Return ONLY valid JSON with this exact shape:
{"questions":[{"question_type":"multiple_choice","prompt":"...","options":["A","B","C","D"],"correct_answer":"exact option text","explanation":"..."}]}
Rules: prefer multiple_choice with 4 options; correct_answer must match one option; no markdown.`
    : `Create ${count} exam practice questions for Nigerian students on: "${course}" (${difficulty} difficulty).
Return ONLY a JSON array:
[{"question_type":"multiple_choice","prompt":"...","options":["A","B","C","D"],"correct_answer":"exact option text","explanation":"..."}]
No markdown fences.`

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: 'You are a quiz generator. Respond with JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  }
  if (useJsonObject) body.response_format = { type: 'json_object' }

  const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!aiRes.ok) {
    const t = await aiRes.text()
    throw new Error(`AI provider error (${aiRes.status}): ${t.slice(0, 180)}`)
  }

  const completion = (await aiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return completion.choices?.[0]?.message?.content?.trim() ?? ''
}

export type GenerateQuizResult = {
  questions: ParsedQuizQuestion[]
  ai_generated: boolean
  fallback?: boolean
  model?: string
  warning?: string
}

/**
 * Always resolves with questions (AI or local fallback). Never throws for empty AI output.
 */
export async function generateQuizQuestionsCore(input: {
  apiKey: string
  model?: string
  count: number
  course: string
  difficulty: string
}): Promise<GenerateQuizResult> {
  const count = Math.min(Math.max(Number(input.count) || 0, 1), 40)
  const course = String(input.course || 'General studies').slice(0, 200)
  const difficulty = input.difficulty || 'medium'
  const primary = input.model || 'openai/gpt-oss-20b'
  const models = [...new Set([primary, ...FALLBACK_MODELS])]

  let lastError = ''

  for (const model of models) {
    for (const tryCount of [count, Math.min(count, 10), Math.min(count, 5)]) {
      for (const useJsonObject of [true, false]) {
        try {
          const text = await callGroqOnce({
            apiKey: input.apiKey,
            model,
            count: tryCount,
            course,
            difficulty,
            useJsonObject,
          })
          if (!text) {
            lastError = 'Empty AI response'
            continue
          }
          const questions = parseGeneratedQuizQuestions(text, tryCount)
          if (!questions.length) {
            lastError = 'Parsed zero questions'
            continue
          }
          return {
            questions: questions.slice(0, count),
            ai_generated: true,
            model,
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Generate failed'
        }
      }
    }
  }

  return {
    questions: buildFallbackQuizQuestions(course, count, difficulty),
    ai_generated: false,
    fallback: true,
    warning: lastError || 'AI unavailable — using practice fallback questions',
  }
}
