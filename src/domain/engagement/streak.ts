import type { DayRecord, StreakState } from '../types'
import { DAY, dayKey, startOfDay } from '../time'

/**
 * The streak.
 *
 * Two design decisions carry the whole mechanic, and both come from the engagement research:
 *
 * 1. **What counts.** Not "opened the app" (hollow) and not "met someone new" (unsatisfiable
 *    during a quiet week, and this app's content supply is involuntary — people walk in off the
 *    street). A day counts when the due retrievals are cleared, or when the user rests on purpose.
 *    That definition is satisfiable with zero social contact and cannot be gamed by app-opening.
 *
 * 2. **Slack increases persistence.** Duolingo's streak-freeze result — and the goal-pursuit work
 *    showing that "emergency reserves" raise long-term persistence rather than licensing slacking
 *    — say the same thing: rigid streaks break people. So: earned freezes, declared rest days,
 *    and a break that never zeroes the biggest number on screen.
 */

export const MAX_FREEZES = 2
export const FREEZE_EARNED_EVERY = 7

/** A day is satisfied by clearing the queue, or by resting deliberately. */
export function dayCounts(d: DayRecord): boolean {
  if (d.restDay) return true
  if (d.retrievalsDue === 0) return d.retrievalsDone > 0 || d.preSleepReviewDone
  return d.retrievalsDone >= d.retrievalsDue
}

export interface StreakComputation extends StreakState {
  /** Days that were saved by a freeze in this computation — surfaced honestly, not hidden. */
  freezesApplied: string[]
  /** True when the most recent day is a gap that no freeze could cover. */
  brokenToday: boolean
}

/**
 * Recompute the streak from the day log. Never stored incrementally — a derived value that can
 * be recomputed is a value that cannot silently corrupt.
 *
 * Freezes are applied automatically to gap days, newest-first, up to the number held.
 */
export function computeStreak(days: DayRecord[], now: number, freezesHeld = MAX_FREEZES): StreakComputation {
  const byDay = new Map(days.map((d) => [d.day, d]))
  const today = dayKey(now)
  // Days before the user ever started are prehistory, not misses. Without this bound a new user
  // with three days of history would have their freezes silently spent on the days before they
  // installed the app.
  const earliestDay = days.length === 0 ? today : days.reduce((min, d) => (d.day < min ? d.day : min), days[0].day)

  let current = 0
  let freezesLeft = freezesHeld
  const freezesApplied: string[] = []
  let brokenToday = false

  // Walk backwards from today. Today itself is never a break — the day isn't over yet.
  for (let offset = 0; offset < 400; offset++) {
    const ts = startOfDay(now) - offset * DAY
    const key = dayKey(ts)
    if (key < earliestDay) break
    const record = byDay.get(key)
    const satisfied = record ? dayCounts(record) : false

    if (satisfied) {
      current++
      continue
    }
    if (key === today) continue // grace: the day is still in progress

    if (freezesLeft > 0) {
      freezesLeft--
      freezesApplied.push(key)
      continue
    }
    if (offset === 1) brokenToday = true
    break
  }

  const longest = longestRun(days)
  const lifetimeRetrievals = days.reduce((s, d) => s + d.retrievalsDone, 0)
  const adherentDays = days.filter(dayCounts).length

  return {
    current,
    longest: Math.max(longest, current),
    freezesHeld: Math.min(MAX_FREEZES, freezesLeft + Math.floor(adherentDays / FREEZE_EARNED_EVERY) - freezesApplied.length),
    lifetimeRetrievals,
    lastCountedDay: current > 0 ? today : null,
    freezesApplied,
    brokenToday,
  }
}

function longestRun(days: DayRecord[]): number {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    if (!dayCounts(d)) {
      run = 0
      prev = d.day
      continue
    }
    run = prev !== null && isConsecutive(prev, d.day) ? run + 1 : 1
    best = Math.max(best, run)
    prev = d.day
  }
  return best
}

function isConsecutive(a: string, b: string): boolean {
  const da = new Date(`${a}T00:00:00`)
  const db = new Date(`${b}T00:00:00`)
  return Math.round((db.getTime() - da.getTime()) / DAY) === 1
}

/**
 * The line shown under a broken streak.
 *
 * The lifetime retrieval count is always displayed beneath the streak so that the number which
 * resets is never the biggest number on screen. A year of real work should not be represented
 * by a zero.
 */
export function streakCopy(s: StreakComputation): { headline: string; sub: string } {
  if (s.current === 0) {
    return {
      headline: 'Welcome back',
      sub: `${s.lifetimeRetrievals.toLocaleString()} retrievals so far — that doesn't reset. Here's a lighter queue.`,
    }
  }
  if (s.freezesApplied.length > 0) {
    return {
      headline: `${s.current}-day streak`,
      // The lifetime count appears here too: it is the number that does not reset, and the design
      // law is that it is never absent from a screen showing a streak.
      sub: `A freeze covered ${s.freezesApplied.length === 1 ? 'a missed day' : `${s.freezesApplied.length} missed days`}. ${s.freezesHeld} left.`,
    }
  }
  return {
    headline: `${s.current}-day streak`,
    sub: `${s.freezesHeld} freeze${s.freezesHeld === 1 ? '' : 's'} held`,
  }
}
