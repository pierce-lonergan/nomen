import { describe, expect, it } from 'vitest'
import { amnesty, buildQueue, promotionCandidates, triageScore } from '../src/domain/scheduler/loadBalancer'
import { createItem } from '../src/domain/scheduler/schedule'
import { DEFAULT_SETTINGS, type Person, type ScheduleItem, type Settings } from '../src/domain/types'
import { DAY } from '../src/domain/time'

const settings: Settings = { ...DEFAULT_SETTINGS, phaseEnteredAt: 0 }
const T0 = new Date('2026-03-02T09:00:00').getTime()

function person(id: string, likelihood: Person['likelihoodOfMeetingAgain'], status: Person['status'] = 'ACTIVE'): Person {
  return {
    id,
    track: 'PERSON',
    displayName: id,
    givenName: id,
    metAt: T0 - DAY,
    likelihoodOfMeetingAgain: likelihood,
    status,
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
  }
}

function itemFor(personId: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return { ...createItem(`i-${personId}`, personId, 'PERSON', 'FACE_TO_NAME', T0 - DAY, settings), ...overrides }
}

describe('triage', () => {
  it('puts in-conversation front-load retrievals above everything else', () => {
    const front = itemFor('a', { rung: 1, due: T0 })
    const overdueWeekly = itemFor('b', { rung: 7, due: T0 - 30 * DAY })
    expect(triageScore(front, person('a', 'LOW'), T0, settings)).toBeGreaterThan(
      triageScore(overdueWeekly, person('b', 'HIGH'), T0, settings),
    )
  })

  it('prefers the person you are more likely to see again — the departure from a generic SRS', () => {
    const colleague = itemFor('a', { rung: 7, due: T0 })
    const stranger = itemFor('b', { rung: 7, due: T0 })
    expect(triageScore(colleague, person('a', 'HIGH'), T0, settings)).toBeGreaterThan(
      triageScore(stranger, person('b', 'LOW'), T0, settings),
    )
  })

  it('measures lateness relative to the interval held, so a 6-month item cannot bully a daily one', () => {
    const daily = itemFor('a', { rung: 5, due: T0 - 2 * DAY }) // 1d interval, 2d late
    const halfYear = itemFor('b', { rung: 10, due: T0 - 2 * DAY }) // 180d interval, 2d late
    const p = person('x', 'MEDIUM')
    expect(triageScore(daily, p, T0, settings)).toBeGreaterThan(triageScore(halfYear, p, T0, settings))
  })
})

describe('daily ceiling', () => {
  it('defers rather than drops when over capacity', () => {
    const items = Array.from({ length: 40 }, (_, i) => itemFor(`p${i}`, { due: T0 - DAY }))
    const people = items.map((i) => person(i.subjectId, 'MEDIUM'))
    const { queue, deferred, overCapacity } = buildQueue(items, people, T0, settings)
    expect(queue).toHaveLength(settings.dailyRetrievalCeiling)
    expect(deferred).toHaveLength(40 - settings.dailyRetrievalCeiling)
    expect(overCapacity).toBe(true)
  })

  it('accounts for retrievals already done today', () => {
    const items = Array.from({ length: 30 }, (_, i) => itemFor(`p${i}`, { due: T0 - DAY }))
    const people = items.map((i) => person(i.subjectId, 'MEDIUM'))
    expect(buildQueue(items, people, T0, settings, 20).queue).toHaveLength(5)
  })
})

describe('intake cap', () => {
  it('promotes at most the cap per day, highest-likelihood first — a wedding is not 30 new items', () => {
    const roster = [
      person('low', 'LOW', 'ROSTER'),
      person('high', 'HIGH', 'ROSTER'),
      ...Array.from({ length: 28 }, (_, i) => person(`m${i}`, 'MEDIUM', 'ROSTER')),
    ]
    const promoted = promotionCandidates(roster, T0, settings, 0)
    expect(promoted).toHaveLength(settings.intakeCapPerDay)
    expect(promoted[0].id).toBe('high')
    expect(promoted.every((p) => p.status === 'ACTIVE')).toBe(true)
    // Nothing is lost — the rest stay on the roster with their records intact.
    expect(roster.filter((p) => p.status === 'ROSTER')).toHaveLength(30)
  })

  it('respects promotions already made today', () => {
    const roster = Array.from({ length: 10 }, (_, i) => person(`m${i}`, 'MEDIUM', 'ROSTER'))
    expect(promotionCandidates(roster, T0, settings, 4)).toHaveLength(1)
    expect(promotionCandidates(roster, T0, settings, 5)).toHaveLength(0)
  })
})

describe('amnesty', () => {
  it('spreads a backlog across the requested window instead of demanding it be cleared', () => {
    const items = Array.from({ length: 60 }, (_, i) => itemFor(`p${i}`, { due: T0 - 10 * DAY }))
    const after = amnesty(items, T0, 14, settings)

    expect(after.filter((i) => i.due <= T0)).toHaveLength(0)
    const span = Math.max(...after.map((i) => i.due)) - T0
    expect(span).toBeLessThanOrEqual(14 * DAY)

    // Roughly even distribution: no single day gets more than the ceiling.
    const perDay = new Map<number, number>()
    for (const i of after) {
      const d = Math.floor((i.due - T0) / DAY)
      perDay.set(d, (perDay.get(d) ?? 0) + 1)
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(settings.dailyRetrievalCeiling)
  })

  it('leaves items that were not overdue alone', () => {
    const future = itemFor('a', { due: T0 + 5 * DAY })
    const overdue = itemFor('b', { due: T0 - DAY })
    const after = amnesty([future, overdue], T0, 7, settings)
    expect(after.find((i) => i.id === future.id)!.due).toBe(future.due)
  })

  it('is a no-op when there is no backlog', () => {
    const items = [itemFor('a', { due: T0 + DAY })]
    expect(amnesty(items, T0, 14, settings)).toEqual(items)
  })
})
