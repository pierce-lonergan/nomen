import type { Attempt, DayRecord, Person, ProtocolAdherence } from '../types'
import { isFreeRecallSuccess, MIN_N } from './recall'

/**
 * Confound analysis.
 *
 * The brief's §9 lists several *non-memory* causes of name failure — hearing in noise, sleep
 * debt, stress, alcohol, attention regulation. Ruling them out is framed neutrally and
 * non-diagnostically, and the payoff is large: it converts "I'm bad with names" into
 * "I'm bad with names in loud rooms", which is a different and far more tractable problem.
 */

export interface Split {
  label: string
  correct: number
  n: number
  rate: number | null
}

export interface ConfoundFinding {
  factor: 'NOISE' | 'ALCOHOL' | 'FATIGUE' | 'STRESS' | 'ADHERENCE'
  splits: Split[]
  /** Percentage-point gap between best and worst split, or null when data is too thin. */
  gapPoints: number | null
  insufficient: boolean
  /** Plain-language read, only emitted when the data supports one. */
  interpretation: string | null
}

function split(label: string, attempts: Attempt[]): Split {
  const n = attempts.length
  const correct = attempts.filter(isFreeRecallSuccess).length
  return { label, correct, n, rate: n === 0 ? null : correct / n }
}

function summarise(
  factor: ConfoundFinding['factor'],
  splits: Split[],
  interpret: (best: Split, worst: Split, gap: number) => string,
): ConfoundFinding {
  const usable = splits.filter((s) => s.n >= MIN_N && s.rate !== null)
  if (usable.length < 2) {
    return { factor, splits, gapPoints: null, insufficient: true, interpretation: null }
  }
  const sorted = [...usable].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const gap = ((best.rate ?? 0) - (worst.rate ?? 0)) * 100
  return {
    factor,
    splits,
    gapPoints: gap,
    insufficient: false,
    interpretation: interpret(best, worst, gap),
  }
}

/**
 * Attempts are joined back to the encoding conditions of the *first* encounter, because the
 * question is whether the name was ever properly encoded — not what the room was like when you
 * happened to be tested.
 */
export function analyseConfounds(attempts: Attempt[], people: Person[]): ConfoundFinding[] {
  const byId = new Map(people.map((p) => [p.id, p]))
  const withContext = attempts
    .map((a) => {
      const p = byId.get(a.subjectId)
      const first = p?.encounters[0]
      return first ? { a, ctx: first.context, adherence: first.adherence } : null
    })
    .filter((x): x is { a: Attempt; ctx: Person['encounters'][0]['context']; adherence: ProtocolAdherence } => x !== null)

  const pick = (fn: (x: (typeof withContext)[0]) => boolean) => withContext.filter(fn).map((x) => x.a)

  return [
    summarise(
      'NOISE',
      [
        split('Quiet', pick((x) => x.ctx.noise === 'QUIET')),
        split('Moderate', pick((x) => x.ctx.noise === 'MODERATE')),
        split('Loud', pick((x) => x.ctx.noise === 'LOUD')),
      ],
      (_b, _w, gap) =>
        gap >= 20
          ? `Names met in noise are recalled ${Math.round(gap)} points worse. That gap points at hearing the name, not remembering it — treat it as an input problem: ask for a repeat every time, and move somewhere quieter for the introduction.`
          : `No large noise effect in your data (${Math.round(gap)} point spread).`,
    ),
    summarise(
      'ALCOHOL',
      [
        split('Sober', pick((x) => !x.ctx.alcohol)),
        split('Drinking', pick((x) => x.ctx.alcohol)),
      ],
      (_b, _w, gap) =>
        gap >= 15
          ? `Names met while drinking are ${Math.round(gap)} points worse — consistent with impaired hippocampal binding at encoding. Worth capturing those names in writing on the spot.`
          : `No large alcohol effect in your data (${Math.round(gap)} point spread).`,
    ),
    summarise(
      'FATIGUE',
      [
        split('Rested (1–2)', pick((x) => x.ctx.fatigue <= 2)),
        split('Tired (3)', pick((x) => x.ctx.fatigue === 3)),
        split('Exhausted (4–5)', pick((x) => x.ctx.fatigue >= 4)),
      ],
      (_b, _w, gap) =>
        gap >= 15
          ? `Tiredness costs you about ${Math.round(gap)} points. Sleep affects both the attention that encodes the name and the consolidation that keeps it.`
          : `No large fatigue effect in your data (${Math.round(gap)} point spread).`,
    ),
    summarise(
      'STRESS',
      [
        split('Calm (1–2)', pick((x) => x.ctx.stress <= 2)),
        split('Tense (3)', pick((x) => x.ctx.stress === 3)),
        split('Stressed (4–5)', pick((x) => x.ctx.stress >= 4)),
      ],
      (_b, _w, gap) =>
        gap >= 15
          ? `High-stress introductions cost you ${Math.round(gap)} points — the expected pattern if attention turns inward at the moment the name is spoken. The LOOK beat is the countermeasure.`
          : `No large stress effect in your data (${Math.round(gap)} point spread).`,
    ),
    summarise(
      'ADHERENCE',
      [
        split('Full protocol', pick((x) => Object.values(x.adherence).every(Boolean))),
        split('Partial protocol', pick((x) => !Object.values(x.adherence).every(Boolean))),
      ],
      (_b, _w, gap) =>
        gap >= 10
          ? `Running the full four-beat protocol is worth about ${Math.round(gap)} points to you. This is the cheapest win available and it is entirely under your control.`
          : `Protocol adherence isn't separating your outcomes yet (${Math.round(gap)} point spread) — usually because there aren't enough partial-protocol introductions to compare against.`,
    ),
  ]
}

/** Rolling adherence over the recent introductions — the leading process metric. */
export function adherenceRate(people: Person[], sinceMs: number): { rate: number | null; n: number } {
  const encounters = people.flatMap((p) => p.encounters).filter((e) => e.at >= sinceMs)
  if (encounters.length === 0) return { rate: null, n: 0 }
  const full = encounters.filter((e) => e.adherence.heard && e.adherence.said && e.adherence.looked && e.adherence.hooked)
  return { rate: full.length / encounters.length, n: encounters.length }
}

/**
 * Per-beat adherence, so the user can see *which* beat they drop under pressure.
 *
 * Returns `n` alongside the rates: four bars all sitting at 100% mean something very different
 * when they rest on two introductions than on forty, and the app's own rule is that no statistic
 * appears without its sample size.
 */
export function adherenceByBeat(
  people: Person[],
  sinceMs: number,
): { rates: Record<keyof ProtocolAdherence, number | null>; n: number } {
  const encounters = people.flatMap((p) => p.encounters).filter((e) => e.at >= sinceMs)
  const n = encounters.length
  if (n === 0) {
    return { rates: { heard: null, said: null, looked: null, hooked: null }, n: 0 }
  }
  return {
    rates: {
      heard: encounters.filter((e) => e.adherence.heard).length / n,
      said: encounters.filter((e) => e.adherence.said).length / n,
      looked: encounters.filter((e) => e.adherence.looked).length / n,
      hooked: encounters.filter((e) => e.adherence.hooked).length / n,
    },
    n,
  }
}

/**
 * H1 from the engagement hypotheses: is the pre-sleep slot actually the strongest habit anchor?
 * Shipped as a local self-experiment rather than an assumption.
 */
export function preSleepCompliance(days: DayRecord[]): { withReview: number | null; withoutReview: number | null; n: number } {
  const done = days.filter((d) => d.preSleepReviewDone)
  const not = days.filter((d) => !d.preSleepReviewDone)
  const rate = (rows: DayRecord[]) =>
    rows.length === 0
      ? null
      : rows.reduce((s, d) => s + (d.retrievalsDue === 0 ? 1 : d.retrievalsDone / d.retrievalsDue), 0) / rows.length
  return { withReview: rate(done), withoutReview: rate(not), n: days.length }
}
