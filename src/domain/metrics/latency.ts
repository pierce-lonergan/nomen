import type { Attempt } from '../types'
import { isFreeRecallSuccess } from './recall'

/**
 * Retrieval latency — the fluency signal.
 *
 * Instance theory (Logan 1988, 1992) and ACT-R predict that a strategy shifts from slow
 * computation to fast memory retrieval as instances accumulate, with a power-law speed-up.
 * The brief is explicit that the achievable endpoint is "fast and fluent", not "effortless" —
 * so latency, not just accuracy, is a first-class outcome, and its *flattening* is the honest
 * signal that the user has reached the normal tail rather than that they have failed.
 *
 * Fitted model:  RT(N) = a·N^(−b) + c
 *   a = how much practice-reducible time there was to begin with
 *   b = learning rate
 *   c = asymptote: the floor that no amount of practice removes
 */

export interface PowerLawFit {
  a: number
  b: number
  c: number
  /** Coefficient of determination, 0..1. Low values mean "don't read anything into this". */
  r2: number
  n: number
  /** Predicted asymptotic latency in ms — the "this is as fast as it gets" number. */
  asymptoteMs: number
  /** True once the marginal gain per additional retrieval is under 1%: the power-law tail. */
  inTail: boolean
  /**
   * True when the fit explains too little variance to be worth reading. Human retrieval times are
   * noisy, and a badly-fitting curve still produces confident-looking coefficients — so the fit
   * reports its own untrustworthiness rather than leaving the UI to guess.
   */
  weak: boolean
}

/** Below this R², the fitted parameters should not be shown as if they meant something. */
export const MIN_FIT_R2 = 0.3

export function successfulLatencies(attempts: Attempt[]): number[] {
  return attempts
    .filter(isFreeRecallSuccess)
    .sort((x, y) => x.at - y.at)
    .map((a) => a.latencyMs)
}

/**
 * Coarse grid search rather than gradient descent: with a few hundred noisy human RTs, a tighter
 * optimiser would buy precision the data does not contain. The question being answered is
 * "am I getting faster, and is it flattening?" — not "what is b to three decimals?".
 */
export function fitPowerLaw(latencies: number[]): PowerLawFit | null {
  const n = latencies.length
  if (n < 8) return null

  const mean = latencies.reduce((s, v) => s + v, 0) / n
  const ssTot = latencies.reduce((s, v) => s + (v - mean) ** 2, 0)
  // Zero variance is a degenerate but meaningful case: latency has stopped moving, which is
  // exactly the "you are in the tail" answer rather than an absence of one.
  if (ssTot === 0) {
    return { a: 0, b: 0, c: mean, r2: 1, n, asymptoteMs: Math.round(mean), inTail: true, weak: false }
  }

  const maxRt = Math.max(...latencies)
  const minRt = Math.min(...latencies)

  let best: PowerLawFit | null = null
  for (let bi = 1; bi <= 12; bi++) {
    const b = bi * 0.05 // 0.05 … 0.60
    for (let ci = 0; ci <= 10; ci++) {
      const c = minRt * (ci / 10)
      // Least-squares optimum for `a` given b and c is closed-form.
      let num = 0
      let den = 0
      for (let i = 0; i < n; i++) {
        const x = Math.pow(i + 1, -b)
        num += x * (latencies[i] - c)
        den += x * x
      }
      if (den === 0) continue
      const a = Math.max(0, Math.min(maxRt, num / den))

      let ssRes = 0
      for (let i = 0; i < n; i++) {
        const pred = a * Math.pow(i + 1, -b) + c
        ssRes += (latencies[i] - pred) ** 2
      }
      const r2 = 1 - ssRes / ssTot
      if (!best || r2 > best.r2) {
        const nextGain = a * (Math.pow(n, -b) - Math.pow(n + 1, -b))
        const current = a * Math.pow(n, -b) + c
        best = {
          a,
          b,
          c,
          r2,
          n,
          asymptoteMs: Math.round(c),
          inTail: current > 0 && nextGain / current < 0.01,
          weak: r2 < MIN_FIT_R2,
        }
      }
    }
  }
  return best
}

/** Median of the first and last `window` successful retrievals — the plain-language version. */
export function latencyImprovement(
  latencies: number[],
  window = 20,
): { earlyMs: number; recentMs: number; percentFaster: number; n: number } | null {
  if (latencies.length < window * 2) return null
  const early = median(latencies.slice(0, window))
  const recent = median(latencies.slice(-window))
  return {
    earlyMs: Math.round(early),
    recentMs: Math.round(recent),
    percentFaster: early === 0 ? 0 : ((early - recent) / early) * 100,
    n: latencies.length,
  }
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}
