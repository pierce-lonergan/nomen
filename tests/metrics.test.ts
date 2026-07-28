import { describe, expect, it } from 'vitest'
import {
  dividedAttentionGap,
  MIN_N,
  recallAtDelay,
  successRate,
  totRate,
} from '../src/domain/metrics/recall'
import { fitPowerLaw, latencyImprovement, median } from '../src/domain/metrics/latency'
import { adherenceByBeat, adherenceRate, analyseConfounds } from '../src/domain/metrics/confounds'
import type { Attempt, Grade, Person } from '../src/domain/types'
import { DAY, HOUR } from '../src/domain/time'

const T0 = new Date('2026-03-02T09:00:00').getTime()

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: `a${Math.random()}`,
    itemId: 'i1',
    subjectId: 'p1',
    mode: 'FACE_TO_NAME',
    at: T0,
    grade: 'GOT',
    latencyMs: 2000,
    cueUsed: 'FREE',
    delaySinceEncodingMs: 10 * 60 * 1000,
    dividedAttention: false,
    wasRescue: false,
    ...over,
  }
}

function attempts(n: number, grade: Grade, over: Partial<Attempt> = {}): Attempt[] {
  return Array.from({ length: n }, () => attempt({ grade, ...over }))
}

describe('recallAtDelay', () => {
  it('refuses to state a trend below the minimum n — the anti-self-deception rail', () => {
    const stats = recallAtDelay(attempts(MIN_N - 1, 'GOT'))
    const post = stats.find((s) => s.bucket === 'POST_CONVERSATION')!
    expect(post.insufficient).toBe(true)
    expect(post.n).toBe(MIN_N - 1)
    // The proportion is still computed and shown alongside n; what's withheld is the claim.
    expect(post.proportion).toBe(1)
  })

  it('counts a tip-of-the-tongue as a failure of free recall, not a partial success', () => {
    const mixed = [...attempts(5, 'GOT'), ...attempts(5, 'CUED')]
    const post = recallAtDelay(mixed).find((s) => s.bucket === 'POST_CONVERSATION')!
    expect(post.proportion).toBe(0.5)
  })

  it('buckets by delay since the person was first met', () => {
    const rows = [
      ...attempts(3, 'GOT', { delaySinceEncodingMs: 30 * 60 * 1000 }),
      ...attempts(4, 'GOT', { delaySinceEncodingMs: 26 * HOUR }),
      ...attempts(5, 'MISS', { delaySinceEncodingMs: 8 * DAY }),
      ...attempts(2, 'GOT', { delaySinceEncodingMs: 200 * DAY }),
    ]
    const byBucket = Object.fromEntries(recallAtDelay(rows).map((s) => [s.bucket, s.n]))
    expect(byBucket.POST_CONVERSATION).toBe(3)
    expect(byBucket.NEXT_DAY).toBe(4)
    expect(byBucket.ONE_WEEK).toBe(5)
    expect(byBucket.LONGER).toBe(2)
  })
})

describe('tip-of-the-tongue rate', () => {
  it('is tracked as its own process metric', () => {
    const rows = [...attempts(3, 'CUED'), ...attempts(7, 'GOT')]
    expect(totRate(rows).rate).toBeCloseTo(0.3)
    expect(successRate(rows).rate).toBeCloseTo(0.7)
  })

  it('returns null rather than 0 when there is no data', () => {
    expect(totRate([]).rate).toBeNull()
  })
})

describe('dividedAttentionGap', () => {
  it('measures the lab-to-life gap directly', () => {
    const rows = [
      ...attempts(10, 'GOT', { dividedAttention: false }),
      ...attempts(5, 'GOT', { dividedAttention: true }),
      ...attempts(5, 'MISS', { dividedAttention: true }),
    ]
    const gap = dividedAttentionGap(rows)
    expect(gap.focused).toBe(1)
    expect(gap.divided).toBe(0.5)
    expect(gap.gapPoints).toBeCloseTo(50)
  })
})

describe('power-law latency fit', () => {
  it('declines to fit when there is too little data', () => {
    expect(fitPowerLaw([2000, 1900, 1800])).toBeNull()
  })

  it('recovers a decaying practice curve and reports an asymptote', () => {
    // RT = 3000·N^-0.4 + 700
    const synthetic = Array.from({ length: 60 }, (_, i) => 3000 * Math.pow(i + 1, -0.4) + 700)
    const fit = fitPowerLaw(synthetic)!
    expect(fit.r2).toBeGreaterThan(0.95)
    expect(fit.b).toBeGreaterThan(0.2)
    expect(fit.asymptoteMs).toBeGreaterThan(300)
  })

  it('detects the power-law tail, which is the honest "this is as fast as it gets" signal', () => {
    const flat = Array.from({ length: 120 }, () => 900)
    expect(fitPowerLaw(flat)!.inTail).toBe(true)

    // And with realistic jitter around a plateau, deterministically generated.
    const noisyPlateau = Array.from({ length: 120 }, (_, i) => 900 + ((i * 37) % 11) * 10)
    expect(fitPowerLaw(noisyPlateau)!.inTail).toBe(true)
  })

  it('summarises improvement in plain language', () => {
    const latencies = [...Array(20).fill(4000), ...Array(20).fill(2000)]
    const imp = latencyImprovement(latencies, 20)!
    expect(imp.percentFaster).toBeCloseTo(50)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('confound analysis', () => {
  function personWith(id: string, noise: 'QUIET' | 'LOUD', full: boolean): Person {
    return {
      id,
      track: 'PERSON',
      displayName: id,
      givenName: id,
      metAt: T0,
      likelihoodOfMeetingAgain: 'MEDIUM',
      status: 'ACTIVE',
      highValue: false,
      imageMediaIds: [],
      voiceMediaIds: [],
      encounters: [
        {
          id: `e-${id}`,
          at: T0,
          context: { noise, alcohol: false, fatigue: 2, stress: 2, setting: 'test' },
          adherence: { heard: full, said: full, looked: full, hooked: full },
          mediaIds: [],
        },
      ],
    }
  }

  it('separates recall by noise at encoding and interprets a large gap as an input problem', () => {
    const quietPeople = Array.from({ length: 12 }, (_, i) => personWith(`q${i}`, 'QUIET', true))
    const loudPeople = Array.from({ length: 12 }, (_, i) => personWith(`l${i}`, 'LOUD', true))
    const rows = [
      ...quietPeople.map((p) => attempt({ subjectId: p.id, grade: 'GOT' })),
      ...loudPeople.map((p) => attempt({ subjectId: p.id, grade: 'MISS' })),
    ]
    const noise = analyseConfounds(rows, [...quietPeople, ...loudPeople]).find((f) => f.factor === 'NOISE')!
    expect(noise.insufficient).toBe(false)
    expect(noise.gapPoints).toBeCloseTo(100)
    expect(noise.interpretation).toMatch(/input problem/)
  })

  it('stays silent when a split has too few observations to support a claim', () => {
    const people = [personWith('a', 'QUIET', true), personWith('b', 'LOUD', true)]
    const rows = people.map((p) => attempt({ subjectId: p.id }))
    const noise = analyseConfounds(rows, people).find((f) => f.factor === 'NOISE')!
    expect(noise.insufficient).toBe(true)
    expect(noise.interpretation).toBeNull()
  })

  it('reports adherence overall and per beat, so you can see which beat you drop', () => {
    const people = [
      personWith('a', 'QUIET', true),
      personWith('b', 'QUIET', true),
      personWith('c', 'QUIET', false),
    ]
    expect(adherenceRate(people, 0).rate).toBeCloseTo(2 / 3)
    const beats = adherenceByBeat(people, 0)
    expect(beats.rates.said).toBeCloseTo(2 / 3)
    expect(beats.n).toBe(3)
  })

  it('reports no per-beat rate at all when there are no recent introductions', () => {
    const beats = adherenceByBeat([], 0)
    expect(beats.n).toBe(0)
    expect(beats.rates.said).toBeNull()
  })
})
