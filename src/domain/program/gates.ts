import type { Phase } from '../types'
import { DAY } from '../time'
import type { RecallStat } from '../metrics/recall'
import type { DelayBucket } from '../metrics/recall'

/**
 * Phase gating.
 *
 * The brief describes "a mechanistic arc, not a calendar", so phases advance on *measured*
 * criteria. The one deliberate exception is the Phase 1 → 2 time floor: habit automaticity has
 * a median of ~66 days in the habit-formation literature, and letting a keen user skip that on
 * two good weeks would be gating on enthusiasm rather than on habit.
 *
 * This file and `docs/03-year-program.md` are the same specification; if they diverge, this one
 * is the truth, because it is the one that runs.
 */

export interface ProgramSnapshot {
  now: number
  phase: Phase
  phaseEnteredAt: number
  /** Rolling 14-day protocol adherence. */
  adherence: { rate: number | null; n: number }
  recall: RecallStat[]
  successfulRetrievals: number
  /** Share of active people past the single-image trap, 0..1. */
  varietyRatio: number
  /** Percent faster vs. the phase-2 latency baseline, or null if not yet measurable. */
  latencyImprovementPct: number | null
  interferenceAccuracy: number | null
  /** Percentage points by which divided-attention accuracy trails focused accuracy. */
  dividedAttentionGapPoints: number | null
  /** How many of the four Phase-0 instruments have been completed. */
  baselinesCompleted: number
}

export interface Criterion {
  id: string
  label: string
  met: boolean
  /** What the user currently has, formatted for display. */
  actual: string
  required: string
  /** True when the criterion cannot yet be judged because n is too small. */
  insufficient: boolean
}

export interface GateEvaluation {
  phase: Phase
  nextPhase: Phase | null
  criteria: Criterion[]
  canAdvance: boolean
}

export const PHASE_NAMES: Record<Phase, string> = {
  0: 'Baseline & rule-outs',
  1: 'The encoding habit',
  2: 'The retrieval engine',
  3: 'Load, interference, fluency',
  4: 'Maintenance & generalisation',
}

export const PHASE_PURPOSE: Record<Phase, string> = {
  0: 'Find out which stage is actually broken before training it.',
  1: 'Never lose a name you attended to. The largest, cheapest win in the whole year.',
  2: 'Turn captured names into retained names.',
  3: 'Make it work under real conditions — and make it fast.',
  4: 'Keep only what survives without conscious effort.',
}

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`
}

function recallOf(snapshot: ProgramSnapshot, bucket: DelayBucket): RecallStat | undefined {
  return snapshot.recall.find((r) => r.bucket === bucket)
}

function recallCriterion(
  id: string,
  label: string,
  stat: RecallStat | undefined,
  threshold: number,
  minN: number,
): Criterion {
  const n = stat?.n ?? 0
  const rate = stat?.proportion ?? null
  return {
    id,
    label,
    met: n >= minN && rate !== null && rate >= threshold,
    actual: `${pct(rate)} (n=${n})`,
    required: `≥${Math.round(threshold * 100)}% with n≥${minN}`,
    insufficient: n < minN,
  }
}

export function evaluateGate(snapshot: ProgramSnapshot): GateEvaluation {
  const criteria = criteriaFor(snapshot)
  const nextPhase = snapshot.phase >= 4 ? null : ((snapshot.phase + 1) as Phase)
  return {
    phase: snapshot.phase,
    nextPhase,
    criteria,
    canAdvance: nextPhase !== null && criteria.length > 0 && criteria.every((c) => c.met),
  }
}

function criteriaFor(s: ProgramSnapshot): Criterion[] {
  switch (s.phase) {
    // Phase 0 is measurement. Gating it on performance would be incoherent — the point is to find
    // out where you stand, and you cannot fail at finding out.
    case 0:
      return [
        {
          id: 'baselines',
          label: 'Complete all four baseline instruments',
          met: s.baselinesCompleted >= 4,
          actual: `${s.baselinesCompleted}/4`,
          required: '4/4',
          insufficient: false,
        },
      ]

    case 1: {
      const daysIn = Math.floor((s.now - s.phaseEnteredAt) / DAY)
      return [
        {
          id: 'adherence',
          label: 'Protocol adherence over the last 14 days',
          met: s.adherence.n >= 14 && (s.adherence.rate ?? 0) >= 0.8,
          actual: `${pct(s.adherence.rate)} (n=${s.adherence.n})`,
          required: '≥80% with n≥14',
          insufficient: s.adherence.n < 14,
        },
        recallCriterion(
          'post-conversation',
          'Recall after the conversation ends',
          recallOf(s, 'POST_CONVERSATION'),
          0.7,
          15,
        ),
        {
          id: 'habit-floor',
          label: 'Time in phase (habit-formation floor)',
          met: daysIn >= 45,
          actual: `${daysIn} days`,
          required: '≥45 days',
          insufficient: false,
        },
      ]
    }

    case 2:
      return [
        recallCriterion('recall-1w', 'Recall at 1 week', recallOf(s, 'ONE_WEEK'), 0.65, 20),
        recallCriterion('recall-1m', 'Recall at 1 month', recallOf(s, 'ONE_MONTH'), 0.5, 10),
        {
          id: 'volume',
          label: 'Successful retrievals logged',
          met: s.successfulRetrievals >= 200,
          actual: `${s.successfulRetrievals}`,
          required: '≥200',
          insufficient: false,
        },
        {
          id: 'variety',
          label: 'People known from more than one occasion',
          met: s.varietyRatio >= 0.6,
          actual: pct(s.varietyRatio),
          required: '≥60%',
          insufficient: false,
        },
      ]

    case 3:
      return [
        {
          id: 'latency',
          label: 'Median retrieval latency vs. phase-2 baseline',
          met: (s.latencyImprovementPct ?? 0) >= 30,
          actual: s.latencyImprovementPct === null ? '—' : `${Math.round(s.latencyImprovementPct)}% faster`,
          required: '≥30% faster',
          insufficient: s.latencyImprovementPct === null,
        },
        {
          id: 'interference',
          label: 'Accuracy on similar-name interference sets',
          met: (s.interferenceAccuracy ?? 0) >= 0.7,
          actual: pct(s.interferenceAccuracy),
          required: '≥70%',
          insufficient: s.interferenceAccuracy === null,
        },
        {
          id: 'divided',
          label: 'Divided-attention accuracy vs. undistracted',
          met: s.dividedAttentionGapPoints !== null && s.dividedAttentionGapPoints <= 20,
          actual:
            s.dividedAttentionGapPoints === null
              ? '—'
              : `${Math.round(s.dividedAttentionGapPoints)} points behind`,
          required: 'within 20 points',
          insufficient: s.dividedAttentionGapPoints === null,
        },
        recallCriterion('recall-1m-p3', 'Recall at 1 month', recallOf(s, 'ONE_MONTH'), 0.65, 20),
      ]

    // Phase 4 is ongoing by design: unrehearsed names decay, so maintenance never "completes".
    case 4:
      return []
  }
}

/**
 * The honest end-of-phase capability statement. Written by the app, from measurements, and
 * deliberately including what is *not* achievable — over-promising is what ends the year at
 * month three.
 */
export function capabilityStatement(s: ProgramSnapshot): string {
  const post = recallOf(s, 'POST_CONVERSATION')?.proportion
  const week = recallOf(s, 'ONE_WEEK')?.proportion
  const month = recallOf(s, 'ONE_MONTH')?.proportion
  const parts: string[] = []

  if (post !== null && post !== undefined) {
    parts.push(`You hold ${Math.round(post * 100)}% of names past the end of the conversation`)
  }
  if (week !== null && week !== undefined) {
    parts.push(`${Math.round(week * 100)}% at a week`)
  }
  if (month !== null && month !== undefined) {
    parts.push(`${Math.round(month * 100)}% at a month`)
  }
  if (parts.length === 0) return 'Not enough data yet to say anything honest about your recall.'

  const gains =
    s.latencyImprovementPct && s.latencyImprovementPct > 5
      ? ` Retrieval is about ${Math.round(s.latencyImprovementPct)}% faster than when you started.`
      : ''

  return `${parts.join(', ')}.${gains} What this does not mean: names you stop re-retrieving will still fade, and retrieval will never become effortless the way reading is — every new person is a new binding.`
}
