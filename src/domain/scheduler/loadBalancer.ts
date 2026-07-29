import type { MeetAgainLikelihood, Person, ScheduleItem, Settings } from '../types'
import { DAY, dayKey } from '../time'
import { FRONT_LOAD_RUNGS, ladderFor } from './ladder'
import { dueItems } from './schedule'

/**
 * The anti-abandonment engine.
 *
 * The best-documented way a spaced-repetition tool dies is the review-debt spiral: unlimited
 * intake → a missed weekend → a wall of overdue cards → the tool becomes a debt → abandonment.
 * The fix is not willpower. It is capping *intake*, keeping the daily queue small, and making
 * a backlog reschedulable in one tap.
 *
 * Nomen has one advantage a generic SRS does not: its items are people, so it can triage by
 * *who you are actually likely to see next* rather than by due date. That is the single sharpest
 * departure from a conventional scheduler.
 */

const LIKELIHOOD_WEIGHT: Record<MeetAgainLikelihood, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }

/** Breathing room after an amnesty before the first rescheduled item comes due. */
const AMNESTY_GRACE = 30 * 60 * 1000

export interface QueueResult {
  queue: ScheduleItem[]
  /** Due but over the ceiling. Deferred, never dropped — and surfaced honestly in the UI. */
  deferred: ScheduleItem[]
  overCapacity: boolean
}

/**
 * Triage score. Higher goes first.
 *
 *  - In-conversation front-load rungs are time-critical and always outrank everything.
 *  - Then: who you'll see again soonest.
 *  - Then: how far past due, as a fraction of the interval being held (not absolute lateness,
 *    which would let a 6-month item bully a 1-day item).
 */
export function triageScore(
  item: ScheduleItem,
  person: Person | undefined,
  now: number,
  settings: Settings,
): number {
  // Scored relative to `now`, not on the raw timestamp: the ordering within the front-load band
  // is "most overdue first", and the band as a whole sits above everything else.
  if (item.rung < FRONT_LOAD_RUNGS) return 1_000_000 + (now - item.due) / 1000

  const ladder = ladderFor(settings.scheduleMode)
  const likelihood = LIKELIHOOD_WEIGHT[person?.likelihoodOfMeetingAgain ?? 'MEDIUM']
  const overdueRatio = Math.min(4, Math.max(0, (now - item.due) / ladder[item.rung].ms))
  const reencodePenalty = item.needsReencoding ? -50 : 0

  return likelihood * 100 + overdueRatio * 25 + reencodePenalty
}

export function buildQueue(
  items: ScheduleItem[],
  people: Person[],
  now: number,
  settings: Settings,
  retrievalsDoneToday = 0,
): QueueResult {
  const byId = new Map(people.map((p) => [p.id, p]))
  const due = dueItems(items, now).sort(
    (a, b) =>
      triageScore(b, byId.get(b.subjectId), now, settings) -
      triageScore(a, byId.get(a.subjectId), now, settings),
  )

  const remaining = Math.max(0, settings.dailyRetrievalCeiling - retrievalsDoneToday)
  return {
    queue: due.slice(0, remaining),
    deferred: due.slice(remaining),
    overCapacity: due.length > remaining,
  }
}

/**
 * Which roster people get promoted into active rotation today.
 *
 * Meeting thirty people at a wedding must not create thirty active items. The extras sit in the
 * Roster with their names and photos intact and are promoted at the cap rate, highest-likelihood
 * first. Nothing is lost; the queue simply never explodes.
 */
export function promotionCandidates(
  people: Person[],
  now: number,
  settings: Settings,
  promotedToday: number,
): Person[] {
  const slots = Math.max(0, settings.intakeCapPerDay - promotedToday)
  if (slots === 0) return []
  return people
    .filter((p) => p.status === 'ROSTER')
    .sort((a, b) => {
      const w = LIKELIHOOD_WEIGHT[b.likelihoodOfMeetingAgain] - LIKELIHOOD_WEIGHT[a.likelihoodOfMeetingAgain]
      return w !== 0 ? w : a.metAt - b.metAt
    })
    .slice(0, slots)
    .map((p) => ({ ...p, status: 'ACTIVE' as const, metAt: p.metAt || now, promotedAt: now }))
}

/**
 * Amnesty: redistribute a backlog across the next `days` instead of demanding it be cleared.
 *
 * One tap, no guilt copy. Returning after two weeks away must never present a wall — that moment
 * is where users quit, and it is entirely a scheduling decision, not a motivation problem.
 */
export function amnesty(
  items: ScheduleItem[],
  now: number,
  days: number,
  settings: Settings,
): ScheduleItem[] {
  const overdue = dueItems(items, now)
  if (overdue.length === 0) return items

  const perDay = Math.max(1, Math.ceil(overdue.length / Math.max(1, days)))
  const rescheduled = new Map<string, number>()
  const byId = new Map(items.map((i) => [i.id, i]))

  // Highest-value items land first so an interrupted amnesty still surfaces what matters.
  const ordered = [...overdue].sort(
    (a, b) => triageScore(b, undefined, now, settings) - triageScore(a, undefined, now, settings),
  )
  ordered.forEach((item, idx) => {
    const dayOffset = Math.floor(idx / perDay)
    // Spread within the day so a single sitting isn't required.
    const withinDay = (idx % perDay) * (DAY / (perDay * 2))
    // Never land exactly on `now`: an amnesty that immediately re-presents an item as due is
    // not an amnesty.
    rescheduled.set(item.id, now + AMNESTY_GRACE + dayOffset * DAY + withinDay)
  })

  return items.map((i) => {
    const due = rescheduled.get(i.id)
    return due === undefined ? i : { ...byId.get(i.id)!, due }
  })
}

/**
 * How many people entered rotation on a given local day — the intake cap's denominator.
 *
 * Counts `promotedAt`, falling back to `metAt` for records written before that field existed (a
 * person captured straight into ACTIVE is promoted the moment they are met, so the fallback is
 * exact rather than approximate). Counting `metAt` alone was the leak: it made a person met last
 * Tuesday free to promote today, so the cap only ever bound within the day of the encounter.
 */
export function promotedOn(people: Person[], day: string): number {
  return people.filter((p) => p.status !== 'ROSTER' && dayKey(p.promotedAt ?? p.metAt) === day).length
}
