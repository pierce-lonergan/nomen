import { describe, expect, it } from 'vitest'
import { DRILLS, drillsAvailable, drillsLive, modesForPhase, modesForSubject } from '../src/domain/drills/registry'
import { promotedOn, promotionCandidates } from '../src/domain/scheduler/loadBalancer'
import { DEFAULT_SETTINGS, MODES_FOR_TRACK, type Person, type Phase } from '../src/domain/types'
import { DAY, dayKey } from '../src/domain/time'

/**
 * Two defects lived in this app for its whole history, and both were the same kind: the interface
 * asserted something the code could not deliver. Neither was caught by 111 passing tests, because
 * nothing asserted the *link* between a claim and its mechanism.
 *
 * These tests assert that link. They fail on the code as it was.
 */

const T0 = new Date('2026-03-02T21:00:00').getTime()

function person(id: string, over: Partial<Person> = {}): Person {
  return {
    id,
    track: 'PERSON',
    displayName: `P ${id}`,
    givenName: `P${id}`,
    metAt: T0,
    likelihoodOfMeetingAgain: 'MEDIUM',
    status: 'ROSTER',
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
    ...over,
  }
}

describe('a drill that says "unlocked" can actually put work in the queue', () => {
  it('never advertises a built drill whose mode the scheduler will not create', () => {
    // THE BUG: five drills were listed with a green "unlocked" pill and could never produce a
    // single scheduled item, because capture() only ever created MODES_FOR_TRACK[track][0].
    for (const d of DRILLS) {
      if (d.notBuilt) continue
      const modes = modesForPhase(d.track, d.minPhase)
      expect(modes, `${d.id} is offered at phase ${d.minPhase} but the scheduler cannot create it`).toContain(d.mode)
    }
  })

  it('says plainly, in words, when a drill is specified but not built', () => {
    for (const d of DRILLS) {
      if (!d.notBuilt) continue
      expect(d.notBuilt.length, `${d.id} must explain itself`).toBeGreaterThan(20)
      // Never silently reachable by the scheduler.
      expect(drillsLive(4).map((x) => x.id)).not.toContain(d.id)
    }
  })

  it('still SHOWS unbuilt drills — a gap is stated, not hidden', () => {
    const shown = drillsAvailable(4).map((d) => d.id)
    expect(shown).toContain('VOICE_TO_NAME')
    expect(shown).toContain('INTERFERENCE')
  })

  it('opens a genuinely new mode at phase 2, so the unlock changes the queue', () => {
    const p1 = modesForPhase('PERSON', 1)
    const p2 = modesForPhase('PERSON', 2)
    expect(p1).toEqual(['FACE_TO_NAME'])
    expect(p2).toContain('NAME_TO_FACE')
    expect(p2.length).toBeGreaterThan(p1.length)
  })

  it('never schedules voice until recording exists', () => {
    for (const phase of [0, 1, 2, 3, 4] as Phase[]) {
      expect(modesForPhase('PERSON', phase)).not.toContain('VOICE_TO_NAME')
    }
  })

  it('withholds name→face from someone with no photograph — the reveal would be an empty box', () => {
    expect(modesForSubject('PERSON', 2, false)).not.toContain('NAME_TO_FACE')
    expect(modesForSubject('PERSON', 2, true)).toContain('NAME_TO_FACE')
  })

  it('keeps every live mode inside what the track actually permits', () => {
    for (const track of Object.keys(MODES_FOR_TRACK) as (keyof typeof MODES_FOR_TRACK)[]) {
      for (const mode of modesForPhase(track, 4)) {
        expect(MODES_FOR_TRACK[track]).toContain(mode)
      }
    }
  })
})

describe('the intake cap actually caps', () => {
  const settings = { ...DEFAULT_SETTINGS, intakeCapPerDay: 5 }
  const today = dayKey(T0)

  it('counts someone promoted today even though you met them last week', () => {
    // THE BUG: promotedOn() counted dayKey(metAt), and promotion preserves metAt — so anyone met
    // on an earlier day was free, and the counter never moved.
    const people = [person('a', { status: 'ACTIVE', metAt: T0 - 7 * DAY, promotedAt: T0 })]
    expect(promotedOn(people, today)).toBe(1)
  })

  it('survives a wedding: 30 met yesterday cannot all be let in this morning', () => {
    const roster = Array.from({ length: 30 }, (_, i) =>
      person(`w${i}`, { metAt: T0 - DAY, status: 'ROSTER' }),
    )

    // Tap "bring them into rotation" over and over, the way a user actually would.
    let people = roster
    let admitted = 0
    for (let tap = 0; tap < 10; tap++) {
      const batch = promotionCandidates(people, T0, settings, promotedOn(people, today))
      if (batch.length === 0) break
      admitted += batch.length
      const promoted = new Map(batch.map((p) => [p.id, p]))
      people = people.map((p) => promoted.get(p.id) ?? p)
    }

    expect(admitted).toBe(settings.intakeCapPerDay)
    expect(people.filter((p) => p.status === 'ROSTER')).toHaveLength(25)
  })

  it('stamps promotedAt without disturbing metAt — when you met them is a fact about the encounter', () => {
    const met = T0 - 9 * DAY
    const [p] = promotionCandidates([person('x', { metAt: met })], T0, settings, 0)
    expect(p.metAt).toBe(met)
    expect(p.promotedAt).toBe(T0)
  })

  it('lets the roster through again tomorrow — a cap is a rate, not a wall', () => {
    const people = [
      person('a', { status: 'ACTIVE', metAt: T0 - DAY, promotedAt: T0 }),
      person('b', { status: 'ROSTER', metAt: T0 - DAY }),
    ]
    const tomorrow = T0 + DAY
    expect(promotionCandidates(people, tomorrow, settings, promotedOn(people, dayKey(tomorrow)))).toHaveLength(1)
  })

  it('falls back to metAt for records written before promotedAt existed', () => {
    const legacy = [person('old', { status: 'ACTIVE', metAt: T0 })]
    expect(promotedOn(legacy, today)).toBe(1)
  })
})
