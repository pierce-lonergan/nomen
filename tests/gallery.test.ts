import { describe, expect, it } from 'vitest'
import {
  MIN_ROSTER_FOR_GALLERY,
  PASSES_ALLOWED,
  gradeForClaim,
  holdMsFor,
  ladderHz,
  planRun,
  galleryAvailability,
  rootHzForDay,
  ruleFraction,
  runIsOver,
  PITCH_CEIL_HZ,
  PITCH_FLOOR_HZ,
  type Claim,
} from '../src/domain/gallery/run'
import { createItem } from '../src/domain/scheduler/schedule'
import { DEFAULT_SETTINGS, type Person, type ScheduleItem } from '../src/domain/types'
import { DAY, MINUTE } from '../src/domain/time'
import { bustIdentity, distinctIdentities, silhouetteDistance, silhouetteProfile } from '../src/lib/bust/identity'
import { buildBust } from '../src/lib/bust/mesh'

const T0 = new Date('2026-03-02T21:00:00').getTime()
const settings = DEFAULT_SETTINGS

function person(id: string, over: Partial<Person> = {}): Person {
  return {
    id,
    track: 'PERSON',
    displayName: `P ${id}`,
    givenName: `P${id}`,
    metAt: T0 - 30 * DAY,
    likelihoodOfMeetingAgain: 'MEDIUM',
    status: 'ACTIVE',
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
    ...over,
  }
}

function roster(n: number): Person[] {
  return Array.from({ length: n }, (_, i) => person(`p${i}`))
}

function dueItem(id: string, subjectId: string, overdueMs: number): ScheduleItem {
  const base = createItem(id, subjectId, 'PERSON', 'FACE_TO_NAME', T0 - 40 * DAY, settings)
  return { ...base, rung: 6, due: T0 - overdueMs, lastReviewedAt: T0 - overdueMs - DAY }
}

describe('claims resolve to honest grades', () => {
  const base: Claim = { itemId: 'i1', subjectId: 'p1', kind: 'COLD', latencyMs: 900, dividedAttention: false }

  it('writes no attempt at all for a pass — nothing was retrieved', () => {
    expect(gradeForClaim({ ...base, kind: 'PASSED' }, false)).toBeNull()
    // Even claiming it was "held" cannot manufacture an attempt out of an absent one.
    expect(gradeForClaim({ ...base, kind: 'PASSED' }, true)).toBeNull()
  })

  it('grades a fast cold claim as fluent and a slow one as merely correct', () => {
    expect(gradeForClaim({ ...base, latencyMs: 900 }, true)).toBe('INSTANT')
    expect(gradeForClaim({ ...base, latencyMs: 4000 }, true)).toBe('GOT')
  })

  it('prices the rail as a tip-of-the-tongue, never as a success', () => {
    expect(gradeForClaim({ ...base, kind: 'RAILED', latencyMs: 300 }, true)).toBe('CUED')
  })

  it('makes a blind claim self-defeating rather than punished — it simply resolves to MISS', () => {
    expect(gradeForClaim({ ...base, latencyMs: 40 }, false)).toBe('MISS')
    expect(gradeForClaim({ ...base, kind: 'RAILED', latencyMs: 40 }, false)).toBe('MISS')
  })
})

describe('duration is the amplitude channel', () => {
  it('gives a just-seen item no hold at all', () => {
    expect(holdMsFor(0)).toBe(0)
    expect(holdMsFor(MINUTE)).toBe(0)
  })

  it('scales with the log of the interval genuinely at stake', () => {
    const day = holdMsFor(DAY)
    const week = holdMsFor(7 * DAY)
    expect(week).toBeGreaterThan(day)
    expect(day).toBeGreaterThan(0)
  })

  it('keeps real range across the whole ladder, rather than saturating at the first rung', () => {
    // The failure this guards against is silent: a coefficient that caps out at one day makes
    // every interval from a day to six months feel identical, and the channel stops meaning
    // anything while still looking like it works.
    const steps = [DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY, 180 * DAY].map(holdMsFor)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1])
    expect(steps[0]).toBeLessThan(300)
  })

  it('caps, so nothing ever reads as jank rather than as weight', () => {
    expect(holdMsFor(3650 * DAY)).toBeLessThanOrEqual(400)
  })
})

describe('the pitch ladder survives a long room', () => {
  it('stays inside the register cap for every step it could ever reach', () => {
    const root = rootHzForDay(T0)
    for (let step = 0; step < 200; step++) {
      const hz = ladderHz(root, step)
      expect(hz).toBeGreaterThanOrEqual(PITCH_FLOOR_HZ - 1e-6)
      expect(hz).toBeLessThanOrEqual(PITCH_CEIL_HZ + 1e-6)
    }
  })

  it('rises within a phrase, so the ascent is felt before the octave drop', () => {
    const root = rootHzForDay(T0)
    expect(ladderHz(root, 1)).toBeGreaterThan(ladderHz(root, 0))
    expect(ladderHz(root, 2)).toBeGreaterThan(ladderHz(root, 1))
  })

  it('re-roots by day, which is the whole anti-fatigue measure', () => {
    const a = rootHzForDay(new Date('2026-03-02T21:00:00').getTime())
    const b = rootHzForDay(new Date('2026-03-09T21:00:00').getTime())
    expect(a).not.toBe(b)
  })
})

describe('the shortening rule', () => {
  it('is a rule that gets shorter, never a meter that fills', () => {
    expect(ruleFraction(0)).toBe(1)
    expect(ruleFraction(PASSES_ALLOWED)).toBe(0)
    expect(ruleFraction(1)).toBeGreaterThan(ruleFraction(2))
  })

  it('ends the run only on inaction', () => {
    expect(runIsOver(PASSES_ALLOWED - 1)).toBe(false)
    expect(runIsOver(PASSES_ALLOWED)).toBe(true)
  })
})

describe('availability is a specification, not a dimmed prize', () => {
  it('refuses below the roster floor and says the true number', () => {
    const a = galleryAvailability(roster(4))
    expect(a.available).toBe(false)
    expect(a.activePeople).toBe(4)
    expect(a.reason).toContain('4')
  })

  it('opens at the floor', () => {
    expect(galleryAvailability(roster(MIN_ROSTER_FOR_GALLERY)).available).toBe(true)
  })

  it('does not count roster or non-person tracks toward the floor', () => {
    const mixed = [
      ...roster(MIN_ROSTER_FOR_GALLERY).map((p) => ({ ...p, status: 'ROSTER' as const })),
      ...roster(4).map((p, i) => ({ ...p, id: `cast${i}`, track: 'CAST' as const })),
    ]
    expect(galleryAvailability(mixed).available).toBe(false)
  })
})

describe('the run is built from the real queue', () => {
  const people = roster(20)
  const items = people.map((p, i) => dueItem(`i${i}`, p.id, (i + 1) * DAY))

  it('never puts the boss in an ordinary room', () => {
    const plan = planRun(items, people, T0, settings)
    expect(plan.bossItemId).not.toBeNull()
    const inRooms = plan.rooms.flatMap((r) => r.itemIds)
    expect(inRooms).not.toContain(plan.bossItemId)
  })

  it('makes the corridor shorter when less is owed', () => {
    const light = planRun(items.slice(0, 3), people, T0, settings)
    const heavy = planRun(items, people, T0, settings)
    expect(heavy.totalTargets).toBeGreaterThan(light.totalTargets)
  })

  it('never schedules the same item twice in one run', () => {
    const plan = planRun(items, people, T0, settings)
    const all = [...plan.rooms.flatMap((r) => r.itemIds), plan.bossItemId!]
    expect(new Set(all).size).toBe(all.length)
  })

  it('escalates monotonically — every knob moves the same direction', () => {
    const plan = planRun(items, people, T0, settings)
    for (let i = 1; i < plan.rooms.length; i++) {
      expect(plan.rooms[i].windowMs).toBeLessThan(plan.rooms[i - 1].windowMs)
      expect(plan.rooms[i].busts).toBeGreaterThan(plan.rooms[i - 1].busts)
    }
  })

  it('is deterministic — the same night twice is the same corridor', () => {
    expect(planRun(items, people, T0, settings)).toEqual(planRun(items, people, T0, settings))
  })

  it('excludes items whose subject is not an active person', () => {
    const archived = people.map((p) => ({ ...p, status: 'ARCHIVED' as const }))
    const plan = planRun(items, archived, T0, settings)
    expect(plan.rooms).toHaveLength(0)
  })

  it('survives an empty queue without inventing a room', () => {
    const plan = planRun([], people, T0, settings)
    expect(plan.rooms).toHaveLength(0)
    expect(plan.totalTargets).toBe(0)
  })
})

describe('the sculpted crowd', () => {
  it('is deterministic — a seed is a person, forever', () => {
    expect(bustIdentity('marek')).toEqual(bustIdentity('marek'))
    expect(bustIdentity('marek')).not.toEqual(bustIdentity('priya'))
  })

  it('samples the shell, not the mean — no head is average', () => {
    // Every identity must land meaningfully away from the origin, which is the whole reason for
    // not drawing i.i.d. Gaussians: a room of near-average faces is a room of siblings.
    for (let i = 0; i < 40; i++) {
      const id = bustIdentity(`seed-${i}`)
      const magnitude = Math.hypot(...Object.values(id))
      expect(magnitude).toBeGreaterThan(4)
    }
  })

  it('separates a crowd better than naive seeding does', () => {
    const picked = distinctIdentities('crowd', 14)
    const naive = Array.from({ length: 14 }, (_, i) => bustIdentity(`naive:${i}`))

    const closest = (set: ReturnType<typeof bustIdentity>[]) => {
      const profiles = set.map(silhouetteProfile)
      let min = Infinity
      for (let i = 0; i < profiles.length; i++) {
        for (let j = i + 1; j < profiles.length; j++) {
          min = Math.min(min, silhouetteDistance(profiles[i], profiles[j]))
        }
      }
      return min
    }
    expect(closest(picked)).toBeGreaterThan(closest(naive))
  })

  it('builds a closed, finite mesh at every level of detail', () => {
    for (const lod of [0, 1, 2] as const) {
      const mesh = buildBust(bustIdentity('marek'), lod)
      expect(mesh.vertexCount).toBeGreaterThan(0)
      expect(mesh.indices.length % 3).toBe(0)
      // Uint16 indices cap at 65535 — exceeding it silently wraps and renders confetti.
      expect(mesh.vertexCount).toBeLessThan(65536)
      for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true)
      for (const v of mesh.normals) expect(Number.isFinite(v)).toBe(true)
      for (const v of mesh.occlusion) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('carves the eye sockets — occlusion has real range, or the face is a grey blob', () => {
    const mesh = buildBust(bustIdentity('marek'), 0)
    const min = Math.min(...mesh.occlusion)
    const max = Math.max(...mesh.occlusion)
    expect(max - min).toBeGreaterThan(0.15)
  })

  it('gets cheaper as it recedes', () => {
    const near = buildBust(bustIdentity('x'), 0)
    const far = buildBust(bustIdentity('x'), 2)
    expect(far.indices.length).toBeLessThan(near.indices.length)
  })
})
