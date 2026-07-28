import type { Mission, Person, Phase, ScheduleItem } from '../types'
import { dayKey, stableUnitHash } from '../time'

/**
 * Field missions.
 *
 * The actual reward for this practice happens in the world — greeting someone correctly by name
 * three weeks later — and the app is not there to see it. Missions are the mechanism by which the
 * app reaches out into that world and brings the signal back. They are also the only part of the
 * product that trains the thing under the conditions it will be used in, which the specific-transfer
 * principle says is non-negotiable.
 *
 * Rules: exactly one per day, tiny, real-world, and phase-appropriate. A mission that takes more
 * than a minute of extra effort is a mission that gets skipped and then resented.
 */

interface MissionTemplate {
  kind: Mission['kind']
  minPhase: Phase
  target: number
  text: (ctx: { name?: string }) => string
}

const TEMPLATES: MissionTemplate[] = [
  {
    kind: 'USE_NAME_ALOUD',
    minPhase: 1,
    target: 2,
    text: () => 'Use two people’s names out loud today — in greeting, in a question, in a goodbye.',
  },
  {
    kind: 'ASK_SPELLING',
    minPhase: 1,
    target: 1,
    text: () =>
      'Ask one person how their name is spelled or where it comes from. You get a second clear hearing and a semantic hook in one move.',
  },
  {
    kind: 'PROTOCOL_STREAK',
    minPhase: 1,
    target: 3,
    text: () => 'Run all four beats — hear, say, look, hook — on three introductions today.',
  },
  {
    kind: 'RECONFIRM',
    minPhase: 2,
    target: 1,
    text: (ctx) =>
      ctx.name
        ? `Greet ${ctx.name} by name today if you see them. If you don’t, retrieve the name cold this evening.`
        : 'Greet someone by name today without waiting for them to speak first.',
  },
  {
    kind: 'HIGH_STAKES',
    minPhase: 2,
    target: 1,
    text: () =>
      'Do the full protocol somewhere it’s hard — a party, a queue, a noisy room. That is where the habit is actually tested.',
  },
]

/**
 * Deterministic per-day selection: the mission is stable across app restarts on the same day,
 * and varies across days without a random-number generator anywhere near the domain layer.
 */
export function missionForDay(
  now: number,
  phase: Phase,
  people: Person[],
  items: ScheduleItem[],
): Mission {
  const day = dayKey(now)
  const eligible = TEMPLATES.filter((t) => t.minPhase <= phase)
  const pool = eligible.length > 0 ? eligible : [TEMPLATES[0]]
  const template = pool[Math.floor(stableUnitHash(day) * pool.length) % pool.length]

  // RECONFIRM targets the person whose retrieval is most at risk *and* most likely to be seen.
  let name: string | undefined
  if (template.kind === 'RECONFIRM') {
    const byId = new Map(people.map((p) => [p.id, p]))
    const candidate = items
      .filter((i) => !i.suspended)
      .map((i) => ({ i, p: byId.get(i.subjectId) }))
      .filter((x) => x.p?.likelihoodOfMeetingAgain === 'HIGH' && x.p.status === 'ACTIVE')
      .sort((a, b) => a.i.due - b.i.due)[0]
    name = candidate?.p?.displayName
  }

  return {
    id: `mission-${day}`,
    day,
    kind: template.kind,
    target: template.target,
    progress: 0,
    text: template.text({ name }),
    completed: false,
  }
}

export function advanceMission(mission: Mission, by = 1): Mission {
  const progress = Math.min(mission.target, mission.progress + by)
  return { ...mission, progress, completed: progress >= mission.target }
}
