import { describe, expect, it } from 'vitest'
import { computeStreak, dayCounts, streakCopy } from '../src/domain/engagement/streak'
import { advanceMission, missionForDay } from '../src/domain/engagement/missions'
import { competenceFeedback, dayClose, rewardsForAttempt } from '../src/domain/engagement/rewards'
import { createItem } from '../src/domain/scheduler/schedule'
import { DEFAULT_SETTINGS, type Attempt, type DayRecord, type Person, type Settings } from '../src/domain/types'
import { DAY, dayKey } from '../src/domain/time'

const settings: Settings = { ...DEFAULT_SETTINGS, phaseEnteredAt: 0 }
const T0 = new Date('2026-03-02T09:00:00').getTime()

function day(offsetFromT0: number, over: Partial<DayRecord> = {}): DayRecord {
  return {
    day: dayKey(T0 - offsetFromT0 * DAY),
    retrievalsDue: 5,
    retrievalsDone: 5,
    newPeople: 0,
    namesUsedAloud: 0,
    missionCompleted: false,
    restDay: false,
    freezeUsed: false,
    preSleepReviewDone: true,
    ...over,
  }
}

describe('what counts as a day', () => {
  it('is satisfied by clearing the due retrievals', () => {
    expect(dayCounts(day(0))).toBe(true)
    expect(dayCounts(day(0, { retrievalsDone: 2 }))).toBe(false)
  })

  it('is satisfied by a deliberate rest day — slack is designed in, not an exception', () => {
    expect(dayCounts(day(0, { retrievalsDone: 0, restDay: true }))).toBe(true)
  })

  it('is satisfiable on a day with no social contact and nothing due', () => {
    expect(dayCounts(day(0, { retrievalsDue: 0, retrievalsDone: 0, preSleepReviewDone: true }))).toBe(true)
  })

  it('cannot be satisfied by merely opening the app', () => {
    expect(dayCounts(day(0, { retrievalsDue: 4, retrievalsDone: 0, preSleepReviewDone: true }))).toBe(false)
  })
})

describe('streak', () => {
  it('counts an unbroken run', () => {
    const days = [0, 1, 2, 3, 4].map((i) => day(i))
    expect(computeStreak(days, T0, 0).current).toBe(5)
  })

  it('does not break on today — the day is not over yet', () => {
    const days = [day(0, { retrievalsDone: 0 }), day(1), day(2)]
    expect(computeStreak(days, T0, 0).current).toBe(2)
  })

  it('spends a freeze to cover a missed day, and says so rather than hiding it', () => {
    const days = [day(0), day(1, { retrievalsDone: 0 }), day(2), day(3)]
    const s = computeStreak(days, T0, 2)
    expect(s.current).toBe(3)
    expect(s.freezesApplied).toHaveLength(1)
    expect(streakCopy(s).sub).toMatch(/freeze covered/i)
  })

  it('breaks when the freezes are gone', () => {
    const days = [day(0), day(1, { retrievalsDone: 0 }), day(2)]
    expect(computeStreak(days, T0, 0).current).toBe(1)
  })

  it('never lets the number that resets be the biggest number on screen', () => {
    const days = [day(0, { retrievalsDone: 0 }), day(1, { retrievalsDone: 0 }), day(5, { retrievalsDone: 40 })]
    const s = computeStreak(days, T0, 0)
    expect(s.current).toBe(0)
    const copy = streakCopy(s)
    expect(copy.headline).toBe('Welcome back')
    expect(copy.sub).toMatch(/40 retrievals so far/)
    expect(copy.sub).toMatch(/lighter queue/)
    expect(copy.sub).not.toMatch(/lost|failed|broke/i)
  })

  it('tracks lifetime retrievals across the whole log', () => {
    const days = [day(0, { retrievalsDone: 3 }), day(1, { retrievalsDone: 4 })]
    expect(computeStreak(days, T0, 0).lifetimeRetrievals).toBe(7)
  })
})

describe('missions', () => {
  const people: Person[] = [
    {
      id: 'p1',
      track: 'PERSON',
      displayName: 'Sarah',
      givenName: 'Sarah',
      metAt: T0 - DAY,
      likelihoodOfMeetingAgain: 'HIGH',
      status: 'ACTIVE',
      highValue: false,
      encounters: [],
      imageMediaIds: [],
      voiceMediaIds: [],
    },
  ]
  const items = [createItem('i1', 'p1', 'PERSON', 'FACE_TO_NAME', T0 - DAY, settings)]

  it('is stable within a day and varies across days, with no RNG in the domain layer', () => {
    const a = missionForDay(T0, 2, people, items)
    const b = missionForDay(T0 + 3 * 60 * 60 * 1000, 2, people, items)
    expect(a.id).toBe(b.id)
    expect(a.text).toBe(b.text)

    const texts = new Set(
      Array.from({ length: 14 }, (_, i) => missionForDay(T0 + i * DAY, 2, people, items).text),
    )
    expect(texts.size).toBeGreaterThan(1)
  })

  it('only offers phase-appropriate missions', () => {
    for (let i = 0; i < 20; i++) {
      const m = missionForDay(T0 + i * DAY, 1, people, items)
      expect(['USE_NAME_ALOUD', 'ASK_SPELLING', 'PROTOCOL_STREAK']).toContain(m.kind)
    }
  })

  it('completes only when the target is reached', () => {
    const m = { ...missionForDay(T0, 1, people, items), target: 2, progress: 0 }
    expect(advanceMission(m).completed).toBe(false)
    expect(advanceMission(advanceMission(m)).completed).toBe(true)
  })
})

describe('rewards are measurements, never tokens', () => {
  const person: Person = {
    id: 'p1',
    track: 'PERSON',
    displayName: 'Sarah',
    givenName: 'Sarah',
    metAt: T0 - 100 * DAY,
    likelihoodOfMeetingAgain: 'HIGH',
    status: 'ACTIVE',
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
  }
  const attempt: Attempt = {
    id: 'a1',
    itemId: 'i1',
    subjectId: 'p1',
    mode: 'FACE_TO_NAME',
    at: T0,
    grade: 'GOT',
    latencyMs: 2200,
    cueUsed: 'FREE',
    delaySinceEncodingMs: 100 * DAY,
    dividedAttention: false,
    wasRescue: true,
  }
  const item = createItem('i1', 'p1', 'PERSON', 'FACE_TO_NAME', T0 - 90 * DAY, settings)

  it('issues a rescue only when the item was genuinely at risk', () => {
    const events = rewardsForAttempt({ attempt, item, person, intervalCleared: 0, previousBestInterval: 0 })
    expect(events.map((e) => e.kind)).toContain('RESCUE')

    const safe = rewardsForAttempt({
      attempt: { ...attempt, wasRescue: false },
      item,
      person,
      intervalCleared: 0,
      previousBestInterval: 0,
    })
    expect(safe.map((e) => e.kind)).not.toContain('RESCUE')
  })

  it('issues a durability record only when it is actually a record', () => {
    const record = rewardsForAttempt({
      attempt: { ...attempt, wasRescue: false },
      item,
      person,
      intervalCleared: 30 * DAY,
      previousBestInterval: 21 * DAY,
    })
    expect(record[0].kind).toBe('DURABILITY_RECORD')
    expect(record[0].headline).toMatch(/Held for/)

    const notRecord = rewardsForAttempt({
      attempt: { ...attempt, wasRescue: false },
      item,
      person,
      intervalCleared: 10 * DAY,
      previousBestInterval: 21 * DAY,
    })
    expect(notRecord).toHaveLength(0)
  })

  it('issues nothing at all for a failed retrieval — no consolation tokens', () => {
    expect(
      rewardsForAttempt({
        attempt: { ...attempt, grade: 'MISS' },
        item,
        person,
        intervalCleared: 30 * DAY,
        previousBestInterval: 0,
      }),
    ).toHaveLength(0)
  })

  it('frames a miss as information rather than failure', () => {
    expect(competenceFeedback(0, 'MISS')).toMatch(/information, not failure/)
    expect(competenceFeedback(8 * DAY, 'GOT')).toBe('Held for 8d.')
    expect(competenceFeedback(8 * DAY, 'INSTANT')).toMatch(/And fast/)
  })

  it('closes the day with a statement, not a score', () => {
    const close = dayClose({ captured: 2, usedAloud: 1, retrievalsHeld: 6, retrievalsAttempted: 7 })
    expect(close).toBe('2 names captured, 1 used aloud, 6/7 retrievals held.')
    expect(dayClose({ captured: 0, usedAloud: 0, retrievalsHeld: 0, retrievalsAttempted: 0 })).toMatch(
      /That is allowed/,
    )
  })
})
