export type ParsedQuizQuestion = {
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  prompt: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
}

function stripCodeFences(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fence?.[1] ?? text).trim()
}

function extractJsonValue(text: string): unknown {
  const cleaned = stripCodeFences(text)
    .replace(/^\uFEFF/, '')
    .trim()

  // Direct parse
  try {
    return JSON.parse(cleaned)
  } catch {
    // continue
  }

  // Object or array slice
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
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1)
    try {
      return JSON.parse(slice)
    } catch {
      // Trailing commas / smart quotes
      const fixed = slice
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
      return JSON.parse(fixed)
    }
  }

  throw new Error('Could not parse generated questions')
}

function normalizeType(
  raw: unknown,
): 'multiple_choice' | 'true_false' | 'short_answer' {
  const t = String(raw || 'multiple_choice').toLowerCase()
  if (t.includes('true') || t === 'tf') return 'true_false'
  if (t.includes('short')) return 'short_answer'
  return 'multiple_choice'
}

function asQuestionList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.questions)) return obj.questions
    if (Array.isArray(obj.data)) return obj.data
    if (Array.isArray(obj.items)) return obj.items
  }
  return []
}

export function parseGeneratedQuizQuestions(
  text: string,
  count: number,
): ParsedQuizQuestion[] {
  const raw = extractJsonValue(text)
  const list = asQuestionList(raw)
  if (!list.length) throw new Error('Could not parse generated questions')

  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const q = item as Record<string, unknown>
      const prompt = String(q.prompt ?? q.question ?? q.text ?? '').trim()
      const correct = String(
        q.correct_answer ?? q.answer ?? q.correct ?? q.correctAnswer ?? '',
      ).trim()
      if (!prompt || !correct) return null
      const optionsRaw = q.options ?? q.choices ?? null
      const options = Array.isArray(optionsRaw)
        ? optionsRaw.map(String)
        : optionsRaw && typeof optionsRaw === 'object'
          ? Object.values(optionsRaw as Record<string, string>).map(String)
          : null
      return {
        question_type: normalizeType(q.question_type ?? q.type),
        prompt,
        options,
        correct_answer: correct,
        explanation: q.explanation
          ? String(q.explanation)
          : 'AI-generated practice item — verify with your materials.',
      } satisfies ParsedQuizQuestion
    })
    .filter(Boolean)
    .slice(0, count) as ParsedQuizQuestion[]
}

/** Local fallback so exams can still start if the AI response is unusable. */
export function buildFallbackQuizQuestions(
  course: string,
  count: number,
  difficulty: string,
): ParsedQuizQuestion[] {
  const subject = course.trim() || 'General studies'
  const out: ParsedQuizQuestion[] = []
  for (let i = 1; i <= count; i += 1) {
    const options = [
      `Core concept ${i}A in ${subject}`,
      `Core concept ${i}B in ${subject}`,
      `Core concept ${i}C in ${subject}`,
      `Core concept ${i}D in ${subject}`,
    ]
    const correct = options[i % 4]!
    out.push({
      question_type: 'multiple_choice',
      prompt: `(${difficulty}) Practice item ${i} for ${subject}: which option best matches a foundational idea students should revise?`,
      options,
      correct_answer: correct,
      explanation:
        'Fallback practice item used because AI question parsing failed. Re-try later or grow the question bank.',
    })
  }
  return out
}
