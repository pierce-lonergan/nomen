import { describe, expect, it } from 'vitest'
import { adherenceCurve, canDrawTrend, latencyCurve, niceMax, recallTrend } from '../src/domain/metrics/series'
import type { Attempt, Grade, Person } from '../src/domain/types'
import { DAY } from '../src/domain/time'

const T0 = new Date('2026-07-28T12:00:00').getTime()

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: `a-${Math.random()}`,
    itemId: 'i1',
    subjectId: 'p1',
    mode: 'FACE_TO_NAME',
    at: T0,
    grade: 'GOT',
    latencyMs: 2000,
    cueUsed: 'FREE',
    delaySinceEncodingMs: DAY,
    dividedAttention: false,
    wasRescue: false,
    ...over,
  }
}

function personWith(id: string, encounters: { at: number; full: boolean }[]): Person {
  return {
    id,
    track: 'PERSON',
    displayName: id,
    givenName: id,
    metAt: encounters[0]?.at ?? T0,
    likelihoodOfMeetingAgain: 'MEDIUM',
    status: 'ACTIVE',
    highValue: false,
    imageMediaIds: [],
    voiceMediaIds: [],
    encounters: encounters.map((e, i) => ({
      id: `${id}-e${i}`,
      at: e.at,
      context: { noise: 'QUIET', alcohol: false, fatigue: 2, stress: 2, setting: '' },
      adherence: { heard: e.full, said: e.full, looked: e.full, hooked: e.full },
      mediaIds: [],
    })),
  }
}

describe('latencyCurve', () => {
  it('bins by retrieval ordinal, because the power law is a function of repetitions not of dates', () => {
    const attempts = Array.from({ length: 120 }, (_, i) =>
      attempt({ at: T0 + i * 1000, latencyMs: 4000 - i * 20 }),
    )
    const curve = latencyCurve(attempts, 12)
    expect(curve).toHaveLength(12)
    expect(curve[0].y!).toBeGreaterThan(curve[11].y!)
    expect(curve.every((p) => p.n === 10)).toBe(true)
  })

  it('ignores failed retrievals — a latency you never produced is not a latency', () => {
    const rows = [
      ...Array.from({ length: 20 }, () => attempt({ grade: 'GOT' as Grade })),
      ...Array.from({ length: 20 }, () => attempt({ grade: 'MISS' as Grade, latencyMs: 99999 })),
    ]
    const curve = latencyCurve(rows, 4)
    expect(curve.reduce((s, p) => s + p.n, 0)).toBe(20)
  })

  it('marks thin blocks sparse so the chart cannot join them into a confident line', () => {
    const curve = latencyCurve(Array.from({ length: 4 }, () => attempt()), 12)
    expect(curve.every((p) => p.sparse)).toBe(true)
    expect(canDrawTrend(curve)).toBe(false)
  })

  it('returns nothing at all rather than an empty-looking chart', () => {
    expect(latencyCurve([], 12)).toEqual([])
  })
})

describe('adherenceCurve', () => {
  it('leaves a gap for a week with no introductions instead of inventing a 0%', () => {
    const people = [personWith('a', [{ at: T0 - 2 * DAY, full: true }])]
    const curve = adherenceCurve(people, T0, 4)
    const thisWeek = curve[curve.length - 1]
    expect(thisWeek.y).toBe(1)
    // Earlier weeks had no introductions at all.
    expect(curve.slice(0, 3).every((p) => p.y === null && p.n === 0)).toBe(true)
  })

  it('scores a week on the proportion of introductions that ran the full protocol', () => {
    const people = [
      personWith('a', [
        { at: T0 - DAY, full: true },
        { at: T0 - 2 * DAY, full: true },
        { at: T0 - 3 * DAY, full: false },
        { at: T0 - 4 * DAY, full: false },
      ]),
    ]
    const curve = adherenceCurve(people, T0, 2)
    expect(curve[curve.length - 1].y).toBeCloseTo(0.5)
    expect(curve[curve.length - 1].n).toBe(4)
  })
})

describe('recallTrend', () => {
  it('is deliberately coarse — weekly recall is too noisy to read as progress', () => {
    const rows = [
      ...Array.from({ length: 30 }, () => attempt({ at: T0 - 45 * DAY, grade: 'MISS' })),
      ...Array.from({ length: 30 }, () => attempt({ at: T0 - 5 * DAY, grade: 'GOT' })),
    ]
    const trend = recallTrend(rows, T0, 4)
    expect(trend[trend.length - 1].y).toBe(1)
    expect(trend[trend.length - 2].y).toBe(0)
  })

  it('flags a month built on too few attempts rather than plotting it as fact', () => {
    const rows = Array.from({ length: 5 }, () => attempt({ at: T0 - 2 * DAY }))
    const trend = recallTrend(rows, T0, 3)
    expect(trend[trend.length - 1].sparse).toBe(true)
    expect(canDrawTrend(trend)).toBe(false)
  })
})

describe('canDrawTrend', () => {
  it('needs three solid points before a line is allowed', () => {
    const solid = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ x: i, y: 0.5, n: 20, sparse: false, label: '' }))
    expect(canDrawTrend(solid(2))).toBe(false)
    expect(canDrawTrend(solid(3))).toBe(true)
  })

  it('does not count null or sparse points toward that threshold', () => {
    const points = [
      { x: 0, y: 0.5, n: 20, sparse: false, label: '' },
      { x: 1, y: null, n: 0, sparse: false, label: '' },
      { x: 2, y: 0.6, n: 2, sparse: true, label: '' },
      { x: 3, y: 0.7, n: 30, sparse: false, label: '' },
    ]
    expect(canDrawTrend(points)).toBe(false)
  })
})

describe('niceMax', () => {
  it('rounds an axis up to a readable tick', () => {
    expect(niceMax([1200, 3400], 500)).toBe(3500)
    expect(niceMax([], 500)).toBe(500)
    expect(niceMax([0.42, 0.71], 0.25)).toBeCloseTo(0.75)
  })
})
