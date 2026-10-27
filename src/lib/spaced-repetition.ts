import { addDays } from 'date-fns'

export interface SpacedRepetitionState {
  ease_factor: number
  interval_days: number
  repetitions: number
}

export function reviewCard(
  card: SpacedRepetitionState,
  quality: number,
): SpacedRepetitionState & { next_review_at: string } {
  let { ease_factor, interval_days, repetitions } = card

  if (quality < 3) {
    repetitions = 0
    interval_days = 1
  } else {
    if (repetitions === 0) {
      interval_days = 1
    } else if (repetitions === 1) {
      interval_days = 6
    } else {
      interval_days = Math.max(1, Math.round(interval_days * ease_factor))
    }
    repetitions += 1
  }

  ease_factor =
    ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease_factor < 1.3) ease_factor = 1.3

  const next_review_at = addDays(new Date(), interval_days).toISOString()

  return { ease_factor, interval_days, repetitions, next_review_at }
}
