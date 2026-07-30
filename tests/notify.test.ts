import { describe, expect, it } from 'vitest'
import { inQuietHours, nudgeFor } from '../src/lib/notify'
import { buildDailyPlan, shouldPrompt } from '../src/domain/program/dailyPlan'
import { createItem } from '../src/domain/scheduler/schedule'
import { DEFAULT_SETTINGS, type DayRecord, type Person } from '../src/domain/types'
import { DAY } from '../src/domain/time'

/**
 * Settings publishes two promises about notifications: never one you did not configure, and never
 * between 22:00 and 07:00. A promise in copy that is not enforced in code is the exact failure
 * mode this app exists to refuse, so both are asserted here.
 */

const settings = DEFAULT_SETTINGS

function at(hour: number): number {
  return new Date(2026, 2, 2, hour, 30, 0).getTime()
}

function person(id: string): Person {
  return {
    id,
    track: 'PERSON',
    displayName: `P ${id}`,
    givenName: id,
    metAt: at(9) - 30 * DAY,
    likelihoodOfMeetingAgain: 'MEDIUM',
    status: 'ACTIVE',
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
  }
}

function planWith(dueCount: number, now: number) {
  const people = Array.from({ length: dueCount }, (_, i) => person(`p${i}`))
  const items = people.map((p, i) => ({
    ...createItem(`i${i}`, p.id, 'PERSON' as const, 'FACE_TO_NAME' as const, now - 40 * DAY, settings),
    due: now - DAY,
  }))
  return buildDailyPlan(now, people, items, settings, undefined)
}

describe('quiet hours are a gate, not a sentence in the settings screen', () => {
  it.each([22, 23, 0, 3, 6])('refuses at %i:30', (h) => {
    expect(inQuietHours(at(h))).toBe(true)
  })

  it.each([7, 9, 12, 18, 21])('allows at %i:30', (h) => {
    expect(inQuietHours(at(h))).toBe(false)
  })

  it('agrees with the domain, so the two gates cannot drift apart', () => {
    for (const h of [0, 3, 6, 23]) {
      const now = at(h)
      expect(inQuietHours(now)).toBe(true)
      expect(shouldPrompt(planWith(6, now), now, undefined).fire).toBe(false)
    }
  })
})

describe('the nudge states a fact and applies no pressure', () => {
  it('says nothing at all when nothing is due', () => {
    const now = at(9)
    expect(nudgeFor(planWith(0, now))).toBeNull()
  })

  it('names the true count', () => {
    const now = at(9)
    const n = nudgeFor(planWith(4, now))
    expect(n).not.toBeNull()
    expect(n!.body).toMatch(/\b4\b/)
  })

  it('carries no streak, no loss, no urgency, and no exclamation', () => {
    for (const hour of [9, 14, 21]) {
      const n = nudgeFor(planWith(5, at(hour)))
      if (!n) continue
      const text = `${n.title} ${n.body}`
      expect(text).not.toMatch(/!/)
      expect(text).not.toMatch(/streak|lose|losing|don't|last chance|hurry|now or/i)
    }
  })

  it('stays true with the clock removed — the charter\'s own test for urgency copy', () => {
    // "6 due" is a fact whether or not you read it this minute. "6 due before it's too late" is
    // only true because of the clock, and that is manufactured urgency.
    const n = nudgeFor(planWith(6, at(21)))!
    expect(n.body).toMatch(/due/)
    expect(n.body).not.toMatch(/too late|expires|before it/i)
  })
})

describe('the domain decides on state, not on the hour', () => {
  it('stays silent on a declared rest day even with a full queue', () => {
    const now = at(21)
    const rest: DayRecord = {
      day: '2026-03-02',
      retrievalsDue: 0,
      retrievalsDone: 0,
      newPeople: 0,
      namesUsedAloud: 0,
      missionCompleted: false,
      restDay: true,
      freezeUsed: false,
      preSleepReviewDone: false,
    }
    expect(shouldPrompt(planWith(10, now), now, rest).fire).toBe(false)
  })

  it('stays silent when there is nothing worth saying', () => {
    const now = at(14)
    expect(shouldPrompt(planWith(0, now), now, undefined).fire).toBe(false)
  })
})
