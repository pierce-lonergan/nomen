import type { Attempt, Person, RewardEvent, ScheduleItem } from '../types'
import { formatInterval } from '../time'

/**
 * Informational variable reward.
 *
 * Variability motivates, and this domain generates it for free: you genuinely do not know whether
 * you still have a name until you try to retrieve it. So every reward Nomen issues is a *true fact
 * revealed at an unpredictable time*, never a randomised token.
 *
 * This is a deliberate rejection of the variable-ratio schedule at the centre of the Hooked model.
 * The gamification meta-analyses are consistent that points-style rewards lift extrinsic motivation
 * more than intrinsic, do almost nothing for perceived *competence* — the need this app most needs
 * to feed — and carry a documented overjustification risk. A user grinding a streak out of loss
 * aversion is building app-tolerance, not a name-memory practice.
 *
 * Consequently: no loot, no points, no leaderboard, no random bonuses. Just measurements.
 */

export interface RewardContext {
  attempt: Attempt
  item: ScheduleItem
  person: Person | undefined
  intervalCleared: number
  /** Longest interval this person has previously been held across, in ms. */
  previousBestInterval: number
}

export function rewardsForAttempt(ctx: RewardContext): RewardEvent[] {
  const { attempt, person, intervalCleared, previousBestInterval } = ctx
  const events: RewardEvent[] = []
  if (attempt.grade === 'MISS') return events

  // The person's name is deliberately NOT interpolated into these strings. It travels as
  // `subjectId`, so the view can set it in the typeface reserved for people — a name baked into a
  // sentence here would render in the sans like any other word.
  void person

  // RESCUE — the item had drifted into genuine decay risk and you still produced the name.
  if (attempt.wasRescue) {
    events.push({
      kind: 'RESCUE',
      at: attempt.at,
      headline: 'Rescued',
      detail: 'Slipping — overdue and heading for a lapse. You still had it.',
      subjectId: attempt.subjectId,
    })
  }

  // DURABILITY RECORD — a new personal best holding interval for this person. The reward is the
  // measurement itself: "held for 94 days" is a fact about the user's brain, and it is a stronger
  // reinforcer than a coin because it is the thing they actually wanted.
  if (intervalCleared > previousBestInterval && intervalCleared > 24 * 60 * 60 * 1000) {
    events.push({
      kind: 'DURABILITY_RECORD',
      at: attempt.at,
      headline: `Held for ${formatInterval(intervalCleared)}`,
      detail: 'Your longest gap yet for them. The next check is further out again.',
      subjectId: attempt.subjectId,
    })
  }

  return events
}

/** Feedback after every correct retrieval: the interval just cleared, stated plainly. */
export function competenceFeedback(intervalCleared: number, grade: Attempt['grade']): string {
  if (grade === 'MISS') return 'Gone. That is information, not failure — this one comes back sooner.'
  if (grade === 'CUED') return 'Tip of the tongue: the identity was there, the name did not transmit. Comes back sooner.'
  if (intervalCleared <= 0) return 'Caught.'
  const base = `Held for ${formatInterval(intervalCleared)}.`
  return grade === 'INSTANT' ? `${base} And fast.` : base
}

/**
 * The end-of-day close: a statement, not a score.
 *
 * Deliberately has no number that can be maximised for its own sake. Everything in it is a
 * description of what actually happened.
 */
export function dayClose(stats: {
  captured: number
  usedAloud: number
  retrievalsHeld: number
  retrievalsAttempted: number
}): string {
  const bits: string[] = []
  if (stats.captured > 0) bits.push(`${stats.captured} name${stats.captured === 1 ? '' : 's'} captured`)
  if (stats.usedAloud > 0) bits.push(`${stats.usedAloud} used aloud`)
  if (stats.retrievalsAttempted > 0) bits.push(`${stats.retrievalsHeld}/${stats.retrievalsAttempted} retrievals held`)
  if (bits.length === 0) return 'Nothing logged today. That is allowed.'
  return `${bits.join(', ')}.`
}
