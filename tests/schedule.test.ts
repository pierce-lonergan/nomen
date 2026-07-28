import { describe, expect, it } from 'vitest'
import { applyGrade, atRiskItems, createItem, dueItems, gradeFromLatency } from '../src/domain/scheduler/schedule'
import { EXPANDING_LADDER, FRONT_LOAD_RUNGS, UNIFORM_LADDER, ladderFor } from '../src/domain/scheduler/ladder'
import { DEFAULT_SETTINGS, type Settings } from '../src/domain/types'
import { DAY, MINUTE, SECOND } from '../src/domain/time'

const settings: Settings = { ...DEFAULT_SETTINGS, phaseEnteredAt: 0 }
const T0 = new Date('2026-03-02T09:00:00').getTime()

function item(now = T0) {
  return createItem('item-1', 'person-1', 'PERSON', 'FACE_TO_NAME', now, settings)
}

describe('ladder', () => {
  it('front-loads the first retrieval at 20 seconds', () => {
    expect(EXPANDING_LADDER[0].ms).toBe(20 * SECOND)
  })

  it('keeps the front-load in the uniform arm, then holds a constant interval', () => {
    const uniformTail = UNIFORM_LADDER.slice(FRONT_LOAD_RUNGS + 1)
    expect(new Set(uniformTail.map((r) => r.ms)).size).toBe(1)
    expect(UNIFORM_LADDER.slice(0, FRONT_LOAD_RUNGS)).toEqual(EXPANDING_LADDER.slice(0, FRONT_LOAD_RUNGS))
  })

  it('expands monotonically in the expanding arm', () => {
    const fixed = EXPANDING_LADDER.filter((r) => r.kind === 'FIXED').map((r) => r.ms)
    for (let i = 1; i < fixed.length; i++) expect(fixed[i]).toBeGreaterThan(fixed[i - 1])
  })
})

describe('createItem', () => {
  it('schedules the first retrieval 20 seconds out, with no jitter inside the conversation', () => {
    expect(item().due).toBe(T0 + 20 * SECOND)
  })
})

describe('applyGrade', () => {
  it('advances one rung on a correct retrieval', () => {
    const { item: next } = applyGrade(item(), 'GOT', T0 + 20 * SECOND, settings)
    expect(next.rung).toBe(1)
    expect(next.reps).toBe(1)
    expect(next.lapses).toBe(0)
  })

  it('gives a fluent retrieval a stretched interval', () => {
    const start = { ...item(), rung: 6 } // 3 days
    const got = applyGrade(start, 'GOT', T0, settings)
    const instant = applyGrade(start, 'INSTANT', T0, settings)
    expect(instant.item.due - T0).toBeGreaterThan(got.item.due - T0)
  })

  it('drops two rungs and records a lapse on a miss', () => {
    const start = { ...item(), rung: 7 }
    const { item: next } = applyGrade(start, 'MISS', T0, settings)
    expect(next.rung).toBe(5)
    expect(next.lapses).toBe(1)
  })

  it('drops one rung on a tip-of-the-tongue, which is weaker than a miss but not a success', () => {
    const start = { ...item(), rung: 7 }
    expect(applyGrade(start, 'CUED', T0, settings).item.rung).toBe(6)
  })

  it('never drops below the first rung', () => {
    expect(applyGrade(item(), 'MISS', T0, settings).item.rung).toBe(0)
  })

  it('caps at the final rung so maintenance repeats forever rather than ending', () => {
    const last = ladderFor('expanding').length - 1
    const start = { ...item(), rung: last }
    expect(applyGrade(start, 'GOT', T0, settings).item.rung).toBe(last)
  })

  it('eases the cue floor only after repeated failure, not on the first miss', () => {
    const first = applyGrade(item(), 'MISS', T0, settings).item
    expect(first.cueFloor).toBe('FREE')
    const second = applyGrade(first, 'MISS', T0 + MINUTE, settings).item
    expect(second.cueFloor).toBe('SEMANTIC_CONTEXT')
  })

  it('flags an item for re-encoding after three lapses instead of drilling it harder', () => {
    let it = item()
    for (let i = 0; i < 3; i++) it = applyGrade(it, 'MISS', T0 + i * MINUTE, settings).item
    expect(it.needsReencoding).toBe(true)
    expect(dueItems([it], T0 + DAY)).toHaveLength(0)
  })

  it('reports the interval just cleared, which is what the user is shown', () => {
    const first = applyGrade(item(), 'GOT', T0 + 20 * SECOND, settings).item
    const second = applyGrade(first, 'GOT', T0 + 20 * SECOND + 3 * MINUTE, settings)
    expect(second.intervalCleared).toBe(3 * MINUTE)
  })

  it('only calls a retrieval a rescue when the item was genuinely overdue past the front-load', () => {
    const held = { ...item(), rung: 7, due: T0 } // holding 1 week
    const onTime = applyGrade(held, 'GOT', T0, settings)
    expect(onTime.wasRescue).toBe(false)

    const late = applyGrade(held, 'GOT', T0 + 5 * DAY, settings)
    expect(late.wasRescue).toBe(true)

    const earlyRung = { ...item(), rung: 1, due: T0 }
    expect(applyGrade(earlyRung, 'GOT', T0 + DAY, settings).wasRescue).toBe(false)
  })
})

describe('gradeFromLatency', () => {
  it('separates fluent from merely correct', () => {
    expect(gradeFromLatency(true, false, 800)).toBe('INSTANT')
    expect(gradeFromLatency(true, false, 4000)).toBe('GOT')
    expect(gradeFromLatency(true, true, 800)).toBe('CUED')
    expect(gradeFromLatency(false, false, 800)).toBe('MISS')
  })
})

describe('atRiskItems', () => {
  it('surfaces items overdue by more than half their holding interval, worst first', () => {
    const a = { ...item(), id: 'a', rung: 7, due: T0 - 6 * DAY }
    const b = { ...item(), id: 'b', rung: 5, due: T0 - 5 * MINUTE }
    const risk = atRiskItems([a, b], T0, settings)
    expect(risk.map((i) => i.id)).toEqual(['a'])
  })
})

describe('a simulated year on the expanding ladder', () => {
  it('reaches maintenance intervals with a realistic mix of hits and misses', () => {
    let it = item()
    let now = T0
    let attempts = 0
    // Simulate a user who gets it right 80% of the time, deterministically.
    while (now < T0 + 365 * DAY && attempts < 400) {
      now = Math.max(now, it.due)
      const correct = attempts % 5 !== 3
      const out = applyGrade(it, correct ? 'GOT' : 'MISS', now, settings)
      it = out.item
      attempts++
    }
    // With that hit rate the item should have climbed well past the front-load and be holding
    // an interval measured in weeks, not minutes.
    expect(it.rung).toBeGreaterThan(FRONT_LOAD_RUNGS)
    expect(attempts).toBeLessThan(120)
  })
})
