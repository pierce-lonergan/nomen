import type { Grade, RetrievalMode, ScheduleItem, Settings, TrackKind } from '../types'
import { INSTANT_THRESHOLD_MS } from '../types'
import { nextPreSleep, stableUnitHash } from '../time'
import { FRONT_LOAD_RUNGS, ladderFor, type Rung } from './ladder'
import { easeCue } from './cueLadder'

/** Fluent retrievals earn a stretched interval — the schedule tracks fluency, not just accuracy. */
const INSTANT_BONUS = 1.3

/** ±8% deterministic spread so a busy Tuesday's intake doesn't all come due in the same minute. */
const JITTER = 0.08

/** Three lapses means the *record* is broken (bad photo, no hook, name never heard clearly). */
const REENCODE_LAPSE_THRESHOLD = 3

export function createItem(
  id: string,
  subjectId: string,
  track: TrackKind,
  mode: RetrievalMode,
  now: number,
  settings: Settings,
): ScheduleItem {
  const ladder = ladderFor(settings.scheduleMode)
  return {
    id,
    subjectId,
    track,
    mode,
    rung: 0,
    due: resolveDue(ladder[0], now, settings, id),
    lastReviewedAt: null,
    reps: 0,
    lapses: 0,
    cueFloor: 'FREE',
    createdAt: now,
    suspended: false,
    needsReencoding: false,
  }
}

/** Turn a rung into a concrete due timestamp, resolving PRE_SLEEP and applying stable jitter. */
export function resolveDue(rung: Rung, from: number, settings: Settings, itemId: string): number {
  if (rung.kind === 'PRE_SLEEP') return nextPreSleep(from, settings.preSleepHour)
  // No jitter inside the conversation window — a 20-second check must be a 20-second check.
  if (rung.ms <= 10 * 60 * 1000) return from + rung.ms
  const spread = (stableUnitHash(itemId) * 2 - 1) * JITTER
  return from + Math.round(rung.ms * (1 + spread))
}

export function gradeFromLatency(correct: boolean, cued: boolean, latencyMs: number): Grade {
  if (!correct) return 'MISS'
  if (cued) return 'CUED'
  return latencyMs <= INSTANT_THRESHOLD_MS ? 'INSTANT' : 'GOT'
}

export interface ReviewOutcome {
  item: ScheduleItem
  /** The interval just successfully cleared — the honest "held for 8 days" feedback. */
  intervalCleared: number
  /** True if this retrieval saved an item that was already at or past a lapse-risk margin. */
  wasRescue: boolean
}

/**
 * Apply a grade to an item and return the updated item.
 *
 * | Grade     | Effect                                                              |
 * | --------- | ------------------------------------------------------------------- |
 * | MISS      | drop 2 rungs, lapse++, next attempt gets an easier cue floor          |
 * | CUED      | drop 1 rung (a TOT state — the link transmitted, but weakly)          |
 * | GOT       | advance 1 rung                                                        |
 * | INSTANT   | advance 1 rung with a 1.3× interval bonus                             |
 */
export function applyGrade(
  item: ScheduleItem,
  grade: Grade,
  now: number,
  settings: Settings,
): ReviewOutcome {
  const ladder = ladderFor(settings.scheduleMode)
  const lastRung = ladder.length - 1
  const intervalCleared = item.lastReviewedAt === null ? 0 : now - item.lastReviewedAt

  // An item is "rescued" when it was overdue by more than the interval it was holding — i.e. it
  // had drifted into genuine decay risk — and was still retrieved. That claim has to be true for
  // the reward to be honest, so it is computed, never sprinkled on.
  const overdueBy = now - item.due
  const wasRescue =
    grade !== 'MISS' && item.rung >= FRONT_LOAD_RUNGS && overdueBy > ladder[item.rung].ms * 0.5

  let rung = item.rung
  let lapses = item.lapses
  let cueFloor = item.cueFloor

  switch (grade) {
    case 'MISS':
      rung = Math.max(0, item.rung - 2)
      lapses += 1
      // Errorless fallback, and only here: the brief is clear that errorful-with-feedback is
      // better for healthy adults, and that errorless learning is for severely impaired memory.
      // So easing the cue is a response to repeated failure, not a default posture.
      if (lapses >= 2) cueFloor = easeCue(item.cueFloor)
      break
    case 'CUED':
      rung = Math.max(0, item.rung - 1)
      break
    case 'GOT':
    case 'INSTANT':
      rung = Math.min(lastRung, item.rung + 1)
      // A clean unaided retrieval walks the cue floor back toward free recall.
      if (item.cueFloor !== 'FREE' && grade === 'INSTANT') cueFloor = 'FREE'
      break
  }

  const base = resolveDue(ladder[rung], now, settings, item.id)
  const due =
    grade === 'INSTANT' && ladder[rung].kind === 'FIXED'
      ? now + Math.round((base - now) * INSTANT_BONUS)
      : base

  return {
    item: {
      ...item,
      rung,
      due,
      lastReviewedAt: now,
      reps: item.reps + 1,
      lapses,
      cueFloor,
      needsReencoding: lapses >= REENCODE_LAPSE_THRESHOLD,
    },
    intervalCleared,
    wasRescue,
  }
}

/** Items whose due time has arrived. Suspended and re-encoding-flagged items are held back. */
export function dueItems(items: ScheduleItem[], now: number): ScheduleItem[] {
  return items.filter((i) => !i.suspended && !i.needsReencoding && i.due <= now)
}

/** The label of the interval an item is currently holding — used for progress copy. */
export function currentIntervalLabel(item: ScheduleItem, settings: Settings): string {
  return ladderFor(settings.scheduleMode)[item.rung].label
}

/**
 * Items at genuine decay risk: overdue by more than half their holding interval. This is the
 * weekly "rescue list", and the framing is honest because the decay is real (transmission deficit).
 */
export function atRiskItems(items: ScheduleItem[], now: number, settings: Settings): ScheduleItem[] {
  const ladder = ladderFor(settings.scheduleMode)
  return items
    .filter((i) => !i.suspended && now - i.due > ladder[i.rung].ms * 0.5)
    .sort((a, b) => b.rung - a.rung)
}
