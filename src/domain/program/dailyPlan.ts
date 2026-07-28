import type { DayRecord, Mission, Person, ScheduleItem, Settings } from '../types'
import { dayKey, HOUR, nextPreSleep } from '../time'
import { buildQueue, promotionCandidates, promotedOn, type QueueResult } from '../scheduler/loadBalancer'
import { missionForDay } from '../engagement/missions'
import { atRiskItems } from '../scheduler/schedule'
import { drillsAvailable, nextUnlock, type DrillDef } from '../drills/registry'

/**
 * The day loop.
 *
 * Three touchpoints, ~5 minutes total: a context-aware morning prompt, one field mission carried
 * through the day, and a pre-sleep consolidation review. The pre-sleep slot is doing double duty —
 * it exploits sleep-dependent consolidation, and it is also the most time-stable, lowest-competition
 * anchor available in a normal day, which is what a habit needs.
 */

export type TimeOfDay = 'MORNING' | 'DAY' | 'PRE_SLEEP'

export interface DailyPlan {
  day: string
  timeOfDay: TimeOfDay
  queue: QueueResult
  mission: Mission
  /** Roster people who can be promoted into rotation today under the intake cap. */
  promotable: Person[]
  /** Items at genuine decay risk — the weekly rescue list, surfaced daily when urgent. */
  atRisk: ScheduleItem[]
  preSleepAt: number
  drills: DrillDef[]
  upcomingUnlock: DrillDef | null
  /** The single most useful thing to do right now, in one sentence. */
  focus: string
  /** True when the backlog warrants offering an amnesty rather than a queue. */
  suggestAmnesty: boolean
}

/** Backlog size at which presenting the full queue does more harm than good. */
const AMNESTY_THRESHOLD = 40

export function timeOfDay(now: number, settings: Settings): TimeOfDay {
  const hour = new Date(now).getHours()
  if (hour >= settings.preSleepHour - 1) return 'PRE_SLEEP'
  if (hour < 11) return 'MORNING'
  return 'DAY'
}

export function buildDailyPlan(
  now: number,
  people: Person[],
  items: ScheduleItem[],
  settings: Settings,
  today: DayRecord | undefined,
): DailyPlan {
  const day = dayKey(now)
  const tod = timeOfDay(now, settings)
  const queue = buildQueue(items, people, now, settings, today?.retrievalsDone ?? 0)
  const promotable = promotionCandidates(people, now, settings, promotedOn(people, day))
  const atRisk = atRiskItems(items, now, settings)
  const totalDue = queue.queue.length + queue.deferred.length

  return {
    day,
    timeOfDay: tod,
    queue,
    mission: missionForDay(now, settings.phase, people, items),
    promotable,
    atRisk,
    preSleepAt: nextPreSleep(now, settings.preSleepHour),
    drills: drillsAvailable(settings.phase),
    upcomingUnlock: nextUnlock(settings.phase),
    focus: focusLine(tod, queue, promotable, atRisk, totalDue),
    suggestAmnesty: totalDue >= AMNESTY_THRESHOLD,
  }
}

function focusLine(
  tod: TimeOfDay,
  queue: QueueResult,
  promotable: Person[],
  atRisk: ScheduleItem[],
  totalDue: number,
): string {
  if (totalDue >= AMNESTY_THRESHOLD) {
    return `${totalDue} retrievals have piled up. Spread them over the next two weeks instead of clearing them — a wall is how this stops being useful.`
  }
  if (queue.queue.length === 0 && promotable.length === 0) {
    return tod === 'PRE_SLEEP'
      ? 'Nothing due. Sleep is doing the work tonight.'
      : 'Nothing due. If you meet someone today, that is the whole practice.'
  }
  if (tod === 'PRE_SLEEP') {
    return `${queue.queue.length} retrieval${queue.queue.length === 1 ? '' : 's'} before bed — this is the slot that gets consolidated overnight.`
  }
  if (atRisk.length > 0) {
    return `${atRisk.length} name${atRisk.length === 1 ? '' : 's'} slipping. Those first — they are the ones you are about to lose.`
  }
  if (tod === 'MORNING') {
    return `${queue.queue.length} due this morning. Two minutes now beats ten tonight.`
  }
  return `${queue.queue.length} due. Run them, then use one name out loud today.`
}

/**
 * Whether a context prompt is worth firing.
 *
 * JITAI framing: a prompt should land when the user is both *vulnerable* (the behaviour is at
 * risk) and *receptive* (they can act on it). A fixed 9am ping is the weakest version of this,
 * so the app fires on states rather than on the clock.
 */
export function shouldPrompt(plan: DailyPlan, now: number, today: DayRecord | undefined): { fire: boolean; reason: string } {
  const hour = new Date(now).getHours()
  if (hour < 7 || hour > 22) return { fire: false, reason: 'quiet hours' }
  if (today?.restDay) return { fire: false, reason: 'declared rest day' }

  if (plan.timeOfDay === 'PRE_SLEEP' && !today?.preSleepReviewDone && plan.queue.queue.length > 0) {
    return { fire: true, reason: 'pre-sleep consolidation slot with items due' }
  }
  if (plan.atRisk.length >= 3) {
    return { fire: true, reason: 'names at genuine decay risk' }
  }
  if (plan.timeOfDay === 'MORNING' && plan.queue.queue.length >= 3) {
    return { fire: true, reason: 'morning queue worth clearing before the day starts' }
  }
  return { fire: false, reason: 'nothing urgent — silence is the right default' }
}

/** Names met in the last day whose front-load rungs are still running. */
export function stillInFrontLoad(items: ScheduleItem[], now: number): ScheduleItem[] {
  return items.filter((i) => i.rung < 4 && now - i.createdAt < 24 * HOUR)
}
