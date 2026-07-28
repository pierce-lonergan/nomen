import { DAY, HOUR, MINUTE, SECOND } from '../time'

/**
 * A rung of the retrieval ladder.
 *
 * `PRE_SLEEP` rungs resolve to tonight's consolidation slot rather than a fixed offset, because
 * the mechanism being exploited is sleep-dependent consolidation, not a particular number of hours.
 */
export interface Rung {
  label: string
  kind: 'FIXED' | 'PRE_SLEEP'
  ms: number
}

/**
 * Early-then-expanding.
 *
 * The first four rungs are the front-load: Toppino, Phelan & Gerbier (2018) find the expanding
 * advantage appears precisely when initial learning is weak — a name heard 20 seconds ago is the
 * canonical weak trace — and that the advantage depends on the *first* retrieval succeeding.
 * So the ladder is designed to make retrieval #1 nearly free, then stretch hard.
 */
export const EXPANDING_LADDER: Rung[] = [
  { label: '20 seconds', kind: 'FIXED', ms: 20 * SECOND },
  { label: '2 minutes', kind: 'FIXED', ms: 2 * MINUTE },
  { label: '10 minutes', kind: 'FIXED', ms: 10 * MINUTE },
  { label: '1 hour', kind: 'FIXED', ms: HOUR },
  { label: 'tonight', kind: 'PRE_SLEEP', ms: 8 * HOUR },
  { label: '1 day', kind: 'FIXED', ms: DAY },
  { label: '3 days', kind: 'FIXED', ms: 3 * DAY },
  { label: '1 week', kind: 'FIXED', ms: 7 * DAY },
  { label: '3 weeks', kind: 'FIXED', ms: 21 * DAY },
  { label: '2 months', kind: 'FIXED', ms: 60 * DAY },
  { label: '6 months', kind: 'FIXED', ms: 180 * DAY },
]

/**
 * Equal-interval comparison arm.
 *
 * Shipped as a user-visible setting rather than a hidden flag: the expanding-vs-uniform question
 * is genuinely unresolved (Latimier et al. 2020 meta-analysis, g ≈ 0.03), and an app that claims
 * to be evidence-led should not manufacture certainty it does not have. The front-load is retained
 * in both arms because that is separately justified — it is about first-retrieval success, not
 * about the shape of the schedule.
 */
export const UNIFORM_LADDER: Rung[] = [
  ...EXPANDING_LADDER.slice(0, 5),
  ...Array.from({ length: 8 }, (): Rung => ({ label: '5 days', kind: 'FIXED', ms: 5 * DAY })),
]

/** Rungs 0–3 are the front-load: same-conversation retrievals that should nearly always succeed. */
export const FRONT_LOAD_RUNGS = 4

export function ladderFor(mode: 'expanding' | 'uniform'): Rung[] {
  return mode === 'uniform' ? UNIFORM_LADDER : EXPANDING_LADDER
}
