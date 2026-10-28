import type { SupabaseClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity'

/** Minimum signals before labeling a topic as needing revision. */
export const DEFAULT_MIN_INCORRECT = 2
export const DEFAULT_MIN_ATTEMPTS = 2

export type WeakTopic = {
  topicKey: string
  incorrectCount: number
  correctCount: number
  distinctAttempts: number
  catalogueCourseId: string | null
  accuracy: number
}

export type GeneratedRecommendation = {
  title: string
  body: string
  actionHref: string
  reason: string
  kind: string
  topicKey: string | null
  evidence: Record<string, unknown>
}

function fingerprintPrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
}

/**
 * Recompute topic_performance from graded quiz answers.
 * Call after a quiz is submitted and graded.
 */
export async function refreshTopicPerformance(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: answers } = await supabase
    .from('quiz_answers')
    .select(
      'is_correct, attempt_id, question_id, quiz_questions(topic_label, prompt, quiz_id), quiz_attempts!inner(user_id)',
    )
    .eq('user_id', userId)
    .not('is_correct', 'is', null)
    .limit(2000)

  if (!answers?.length) return

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, catalogue_course_id')
    .eq('user_id', userId)

  const quizCourse = new Map(
    (quizzes ?? []).map((q) => [q.id as string, (q.catalogue_course_id as string | null) ?? null]),
  )

  type Agg = {
    incorrect: number
    correct: number
    attempts: Set<string>
    courseId: string | null
    lastIncorrect: string | null
    lastCorrect: string | null
  }
  const map = new Map<string, Agg>()

  for (const row of answers) {
    const qq = (row as { quiz_questions?: { topic_label?: string | null; prompt?: string; quiz_id?: string } | null })
      .quiz_questions
    const topic =
      qq?.topic_label?.trim() ||
      (qq?.prompt ? fingerprintPrompt(qq.prompt).slice(0, 60) : null)
    if (!topic) continue
    const courseId = qq?.quiz_id ? quizCourse.get(qq.quiz_id) ?? null : null
    const key = `${topic}::${courseId ?? 'none'}`
    let agg = map.get(key)
    if (!agg) {
      agg = {
        incorrect: 0,
        correct: 0,
        attempts: new Set(),
        courseId,
        lastIncorrect: null,
        lastCorrect: null,
      }
      map.set(key, agg)
    }
    const attemptId = (row as { attempt_id: string }).attempt_id
    if (attemptId) agg.attempts.add(attemptId)
    if ((row as { is_correct: boolean }).is_correct) {
      agg.correct += 1
      agg.lastCorrect = new Date().toISOString()
    } else {
      agg.incorrect += 1
      agg.lastIncorrect = new Date().toISOString()
    }
  }

  for (const [key, agg] of map) {
    const topicKey = key.split('::')[0]!
    await supabase.from('topic_performance').upsert(
      {
        user_id: userId,
        topic_key: topicKey,
        catalogue_course_id: agg.courseId,
        incorrect_count: agg.incorrect,
        correct_count: agg.correct,
        distinct_attempts: agg.attempts.size,
        last_incorrect_at: agg.lastIncorrect,
        last_correct_at: agg.lastCorrect,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,topic_key' },
    )
  }
}

export async function loadWeakTopics(
  supabase: SupabaseClient,
  userId: string,
  opts?: { minIncorrect?: number; minAttempts?: number },
): Promise<WeakTopic[]> {
  const minIncorrect = opts?.minIncorrect ?? DEFAULT_MIN_INCORRECT
  const minAttempts = opts?.minAttempts ?? DEFAULT_MIN_ATTEMPTS

  const { data } = await supabase
    .from('topic_performance')
    .select('*')
    .eq('user_id', userId)
    .order('incorrect_count', { ascending: false })

  return ((data as Array<{
    topic_key: string
    incorrect_count: number
    correct_count: number
    distinct_attempts: number
    catalogue_course_id: string | null
  }>) ?? [])
    .filter(
      (r) =>
        r.incorrect_count >= minIncorrect &&
        r.distinct_attempts >= minAttempts &&
        r.incorrect_count > r.correct_count * 0.5,
    )
    .map((r) => {
      const total = r.incorrect_count + r.correct_count
      return {
        topicKey: r.topic_key,
        incorrectCount: r.incorrect_count,
        correctCount: r.correct_count,
        distinctAttempts: r.distinct_attempts,
        catalogueCourseId: r.catalogue_course_id,
        accuracy: total ? r.correct_count / total : 0,
      }
    })
}

/**
 * Build and upsert personalized recommendations.
 * Does not mark weakness from a single quiz — uses topic_performance thresholds.
 */
export async function regenerateRecommendations(
  supabase: SupabaseClient,
  userId: string,
): Promise<GeneratedRecommendation[]> {
  await refreshTopicPerformance(supabase, userId)
  const weak = await loadWeakTopics(supabase, userId)
  const generated: GeneratedRecommendation[] = []

  for (const w of weak.slice(0, 5)) {
    const courseQs = w.catalogueCourseId
      ? `&course=${w.catalogueCourseId}`
      : ''
    generated.push({
      title: `Revise: ${w.topicKey.slice(0, 80)}`,
      body: `Missed ${w.incorrectCount} time(s) across ${w.distinctAttempts} quiz attempts (accuracy ${Math.round(w.accuracy * 100)}%). Review notes, then try a focused practice set.`,
      actionHref: `/app/exams?topic=${encodeURIComponent(w.topicKey)}${courseQs}&difficulty=easy`,
      reason: `Repeated misses on “${w.topicKey}” across ${w.distinctAttempts} attempts — not based on a single quiz.`,
      kind: 'weak_topic_revision',
      topicKey: w.topicKey,
      evidence: {
        incorrectCount: w.incorrectCount,
        correctCount: w.correctCount,
        distinctAttempts: w.distinctAttempts,
        accuracy: w.accuracy,
      },
    })

    generated.push({
      title: `Practice quiz: ${w.topicKey.slice(0, 60)}`,
      body: 'A shorter easy/medium practice set is suggested to rebuild confidence on this topic.',
      actionHref: `/app/exams?topic=${encodeURIComponent(w.topicKey)}${courseQs}&mode=practice&count=10&difficulty=easy`,
      reason: 'Practice at easier difficulty after repeated incorrect answers on this topic.',
      kind: 'practice_quiz',
      topicKey: w.topicKey,
      evidence: { distinctAttempts: w.distinctAttempts },
    })

    const topicNeedle = w.topicKey
      .slice(0, 40)
      .replace(/[%_,.()]/g, ' ')
      .trim()
    const { data: relatedNotes } = topicNeedle
      ? await supabase
          .from('notes')
          .select('id, title')
          .eq('user_id', userId)
          .or(`title.ilike.%${topicNeedle}%,content.ilike.%${topicNeedle}%`)
          .limit(3)
      : { data: [] as Array<{ id: string; title: string }> }

    if (relatedNotes?.length) {
      const note = relatedNotes[0]!
      generated.push({
        title: `Review notes: ${String(note.title).slice(0, 60)}`,
        body: `Found ${relatedNotes.length} note(s) matching “${w.topicKey}”. Re-read before your next practice set.`,
        actionHref: `/app/notes/${note.id}`,
        reason: `Notes matched the weak topic “${w.topicKey}” from multi-attempt performance.`,
        kind: 'related_notes',
        topicKey: w.topicKey,
        evidence: { noteIds: relatedNotes.map((n) => n.id) },
      })
    } else {
      generated.push({
        title: `Add notes for ${w.topicKey.slice(0, 60)}`,
        body: 'No matching notes found yet. Capture a short summary of this topic to support revision.',
        actionHref: '/app/notes/new',
        reason: `Weak topic “${w.topicKey}” has no related notes in your library.`,
        kind: 'related_notes',
        topicKey: w.topicKey,
        evidence: { noteIds: [] },
      })
    }

    // Personalized revision task (idempotent-ish: skip if open task with same title exists)
    const taskTitle = `Revision: ${w.topicKey.slice(0, 100)}`
    const { data: existingTask } = await supabase
      .from('study_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('title', taskTitle)
      .maybeSingle()
    if (!existingTask) {
      await supabase.from('study_tasks').insert({
        user_id: userId,
        title: taskTitle,
        description: `Auto-created from learning engine. ${w.incorrectCount} incorrect across ${w.distinctAttempts} attempts.`,
        priority: 'high',
        is_revision: true,
        status: 'pending',
      })
    }
  }

  // Improvement signal: topics where correct now exceeds incorrect after enough attempts
  const { data: improving } = await supabase
    .from('topic_performance')
    .select('*')
    .eq('user_id', userId)
    .gte('distinct_attempts', 2)
    .gt('correct_count', 0)
    .order('correct_count', { ascending: false })
    .limit(20)

  for (const row of improving ?? []) {
    const r = row as {
      topic_key: string
      correct_count: number
      incorrect_count: number
      distinct_attempts: number
    }
    if (r.correct_count <= r.incorrect_count) continue
    generated.push({
      title: `Improving: ${r.topic_key.slice(0, 80)}`,
      body: `Your later answers are stronger here (${r.correct_count} correct vs ${r.incorrect_count} incorrect across ${r.distinct_attempts} attempts). Consider a harder practice set.`,
      actionHref: `/app/exams?topic=${encodeURIComponent(r.topic_key)}&difficulty=hard&mode=practice`,
      reason: 'Correct answers now outweigh incorrect ones across multiple attempts.',
      kind: 'improvement',
      topicKey: r.topic_key,
      evidence: {
        correct_count: r.correct_count,
        incorrect_count: r.incorrect_count,
        distinct_attempts: r.distinct_attempts,
      },
    })
  }

  // Dismissed topics should not be recreated with same kind+topic in last 24h
  const { data: open } = await supabase
    .from('student_recommendations')
    .select('id, kind, topic_key, dismissed')
    .eq('user_id', userId)

  const openKeys = new Set(
    (open ?? [])
      .filter((r) => !(r as { dismissed: boolean }).dismissed)
      .map((r) => `${(r as { kind: string }).kind}::${(r as { topic_key: string | null }).topic_key ?? ''}`),
  )

  for (const g of generated) {
    const key = `${g.kind}::${g.topicKey ?? ''}`
    if (openKeys.has(key)) continue
    await supabase.from('student_recommendations').insert({
      user_id: userId,
      title: g.title,
      body: g.body,
      action_href: g.actionHref,
      reason: g.reason,
      kind: g.kind,
      topic_key: g.topicKey,
      evidence_json: g.evidence,
      dismissed: false,
    })
    openKeys.add(key)
  }

  await logActivity(supabase, {
    userId,
    eventType: 'recommendations_refreshed',
    metadata: { count: generated.length, weakTopics: weak.length },
  })

  return generated
}

export async function dismissRecommendation(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string,
): Promise<void> {
  await supabase
    .from('student_recommendations')
    .update({ dismissed: true, updated_at: new Date().toISOString() })
    .eq('id', recommendationId)
    .eq('user_id', userId)
  await logActivity(supabase, {
    userId,
    eventType: 'recommendation_dismissed',
    metadata: { recommendationId },
  })
}
