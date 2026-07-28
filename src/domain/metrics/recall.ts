import type { Attempt } from '../types'
import { DAY, HOUR } from '../time'

/**
 * The primary outcome metric, mirroring the Morris "name game" paradigm: proportion of names
 * correctly recalled at fixed delays since the person was first met.
 *
 * Every figure carries its `n`, and below `MIN_N` the app refuses to draw a trend. Subjective
 * memory gains are known to overstate real gains, so the honesty rail is part of the metric,
 * not a UI decoration.
 */

export const MIN_N = 10

export type DelayBucket = 'POST_CONVERSATION' | 'NEXT_DAY' | 'ONE_WEEK' | 'ONE_MONTH' | 'LONGER'

export const DELAY_BUCKETS: { key: DelayBucket; label: string; maxMs: number }[] = [
  { key: 'POST_CONVERSATION', label: 'Same conversation (<1h)', maxMs: HOUR },
  { key: 'NEXT_DAY', label: 'Next day', maxMs: 2 * DAY },
  { key: 'ONE_WEEK', label: '1 week', maxMs: 10 * DAY },
  { key: 'ONE_MONTH', label: '1 month', maxMs: 45 * DAY },
  { key: 'LONGER', label: 'Beyond a month', maxMs: Number.POSITIVE_INFINITY },
]

export function bucketFor(delayMs: number): DelayBucket {
  return (DELAY_BUCKETS.find((b) => delayMs < b.maxMs) ?? DELAY_BUCKETS[DELAY_BUCKETS.length - 1]).key
}

export interface RecallStat {
  bucket: DelayBucket
  label: string
  correct: number
  n: number
  /** Proportion in 0..1, or null when there is not enough data to state one. */
  proportion: number | null
  insufficient: boolean
}

/**
 * `CUED` counts as a failure of *free* recall. It is a tip-of-the-tongue state — the identity
 * resolved but the phonological form did not transmit — and counting it as success would flatter
 * the number the whole app exists to move.
 */
export function isFreeRecallSuccess(a: Attempt): boolean {
  return a.grade === 'GOT' || a.grade === 'INSTANT'
}

export function recallAtDelay(attempts: Attempt[], opts: { dividedAttention?: boolean } = {}): RecallStat[] {
  const relevant = attempts.filter((a) =>
    opts.dividedAttention === undefined ? true : a.dividedAttention === opts.dividedAttention,
  )
  return DELAY_BUCKETS.map(({ key, label }) => {
    const inBucket = relevant.filter((a) => bucketFor(a.delaySinceEncodingMs) === key)
    const correct = inBucket.filter(isFreeRecallSuccess).length
    const n = inBucket.length
    const insufficient = n < MIN_N
    return {
      bucket: key,
      label,
      correct,
      n,
      proportion: n === 0 ? null : correct / n,
      insufficient,
    }
  })
}

/** Tip-of-the-tongue rate — a named process metric in the brief, tracked in its own right. */
export function totRate(attempts: Attempt[]): { rate: number | null; n: number } {
  const n = attempts.length
  if (n === 0) return { rate: null, n }
  return { rate: attempts.filter((a) => a.grade === 'CUED').length / n, n }
}

export function successRate(attempts: Attempt[]): { rate: number | null; n: number } {
  const n = attempts.length
  if (n === 0) return { rate: null, n }
  return { rate: attempts.filter(isFreeRecallSuccess).length / n, n }
}

/**
 * Compare divided-attention performance with undistracted performance on the same material.
 * This is the direct measure of the lab-to-life gap that Patton (1994) exposed, and the Phase 3
 * gate criterion.
 */
export function dividedAttentionGap(attempts: Attempt[]): {
  focused: number | null
  divided: number | null
  gapPoints: number | null
  n: number
} {
  const focused = successRate(attempts.filter((a) => !a.dividedAttention))
  const divided = successRate(attempts.filter((a) => a.dividedAttention))
  // The gap is only stated once both arms carry enough observations to support it. A gap computed
  // from eight divided-attention trials is noise wearing a number's clothes.
  const usable = focused.rate !== null && divided.rate !== null && divided.n >= MIN_N && focused.n >= MIN_N
  const gapPoints = usable ? (focused.rate! - divided.rate!) * 100 : null
  return { focused: focused.rate, divided: divided.rate, gapPoints, n: divided.n }
}
