import type { Attempt, Person } from '../types'
import { DAY, startOfDay } from '../time'
import { isFreeRecallSuccess, MIN_N } from './recall'
import { median } from './latency'

/**
 * Series builders for the charts.
 *
 * These exist as domain functions rather than as chart-local data munging for the same reason the
 * schedulers do: they encode judgements about what may honestly be plotted, and those judgements
 * need to be testable. In particular, **every point carries its own `n`**, and a point built from
 * fewer than `MIN_N` observations is marked `sparse` so the chart can render it as a bare dot
 * rather than joining it into a trend line.
 *
 * A chart that draws a confident line through two observations is a lie told in ink.
 */

export interface SeriesPoint {
  /** Position along the x axis. Meaning depends on the series — see each builder. */
  x: number
  /** The plotted value, or null where there is no data at all for this position. */
  y: number | null
  n: number
  /** Too few observations to join into a trend. The chart must not connect these. */
  sparse: boolean
  label: string
}

/**
 * Median retrieval latency across successive blocks of retrievals — the practice curve.
 *
 * Binned by retrieval *ordinal* rather than by date, because the power law is a function of
 * repetitions, not of elapsed time. A user who does 200 retrievals in a fortnight and a user who
 * does 200 across six months are at the same point on this curve.
 */
export function latencyCurve(attempts: Attempt[], bins = 12): SeriesPoint[] {
  const ordered = attempts
    .filter(isFreeRecallSuccess)
    .sort((a, b) => a.at - b.at)
    .map((a) => a.latencyMs)
  if (ordered.length === 0) return []

  const size = Math.max(1, Math.ceil(ordered.length / bins))
  const points: SeriesPoint[] = []
  for (let start = 0; start < ordered.length; start += size) {
    const block = ordered.slice(start, start + size)
    points.push({
      x: start + block.length / 2,
      y: median(block),
      n: block.length,
      // A block needs a few observations before its median means anything.
      sparse: block.length < 3,
      label: `retrievals ${start + 1}–${start + block.length}`,
    })
  }
  return points
}

/**
 * Weekly protocol adherence — the leading process metric, over time.
 *
 * Weeks with no introductions are `null` rather than zero: you cannot fail to run the protocol on
 * a week when you met nobody, and plotting that as 0% would invent a failure. The chart leaves a
 * gap; it does not interpolate across it.
 */
export function adherenceCurve(people: Person[], now: number, weeks = 12): SeriesPoint[] {
  const encounters = people.flatMap((p) => p.encounters)
  const points: SeriesPoint[] = []

  for (let w = weeks - 1; w >= 0; w--) {
    const end = startOfDay(now) - w * 7 * DAY + DAY
    const start = end - 7 * DAY
    const inWeek = encounters.filter((e) => e.at >= start && e.at < end)
    const full = inWeek.filter(
      (e) => e.adherence.heard && e.adherence.said && e.adherence.looked && e.adherence.hooked,
    ).length
    points.push({
      x: weeks - 1 - w,
      y: inWeek.length === 0 ? null : full / inWeek.length,
      n: inWeek.length,
      sparse: inWeek.length > 0 && inWeek.length < 3,
      label: w === 0 ? 'this week' : `${w} week${w === 1 ? '' : 's'} ago`,
    })
  }
  return points
}

/**
 * Recall proportion by month of practice — the "am I actually getting better" series.
 *
 * Deliberately coarse. Weekly recall is far too noisy to read as progress, and offering a
 * finer-grained view would invite exactly the over-interpretation the honesty rails exist to
 * prevent.
 */
export function recallTrend(attempts: Attempt[], now: number, months = 8): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (let m = months - 1; m >= 0; m--) {
    const end = now - m * 30 * DAY
    const start = end - 30 * DAY
    const inMonth = attempts.filter((a) => a.at >= start && a.at < end)
    const correct = inMonth.filter(isFreeRecallSuccess).length
    points.push({
      x: months - 1 - m,
      y: inMonth.length === 0 ? null : correct / inMonth.length,
      n: inMonth.length,
      sparse: inMonth.length > 0 && inMonth.length < MIN_N,
      label: m === 0 ? 'this month' : `${m} month${m === 1 ? '' : 's'} ago`,
    })
  }
  return points
}

/**
 * Whether a series has enough substance to draw as a connected line at all.
 *
 * The rule: at least three non-sparse points. Below that the chart shows the points alone and
 * says how much more data it needs — which is the calm, intentional version of "no data", not an
 * error state.
 */
export function canDrawTrend(points: SeriesPoint[]): boolean {
  return points.filter((p) => p.y !== null && !p.sparse).length >= 3
}

/** Nice round axis maximum for a millisecond scale, so ticks land on readable numbers. */
export function niceMax(values: number[], step = 500): number {
  const max = values.length === 0 ? step : Math.max(...values)
  return Math.ceil(max / step) * step
}
