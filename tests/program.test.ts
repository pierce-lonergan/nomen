import { describe, expect, it } from 'vitest'
import { capabilityStatement, evaluateGate, type ProgramSnapshot } from '../src/domain/program/gates'
import { buildDailyPlan, shouldPrompt, timeOfDay } from '../src/domain/program/dailyPlan'
import { computeVerdict } from '../src/domain/assessment/verdict'
import { confidenceCeiling, nextDrillImage, varietyCoverage } from '../src/domain/faceVariety'
import { buildCue, easeCue, hardenCue, syllableCount } from '../src/domain/scheduler/cueLadder'
import { drillsAvailable, nextUnlock } from '../src/domain/drills/registry'
import { createItem } from '../src/domain/scheduler/schedule'
import type { RecallStat } from '../src/domain/metrics/recall'
import type { AssessmentResult, MediaRef, Person, Settings } from '../src/domain/types'
import { DEFAULT_SETTINGS } from '../src/domain/types'
import { DAY } from '../src/domain/time'

const settings: Settings = { ...DEFAULT_SETTINGS, phaseEnteredAt: 0 }
const T0 = new Date('2026-03-02T09:00:00').getTime()

function stat(bucket: RecallStat['bucket'], proportion: number, n: number): RecallStat {
  return { bucket, label: bucket, correct: Math.round(proportion * n), n, proportion, insufficient: n < 10 }
}

function snapshot(over: Partial<ProgramSnapshot> = {}): ProgramSnapshot {
  return {
    now: T0,
    phase: 1,
    phaseEnteredAt: T0 - 60 * DAY,
    adherence: { rate: 0.9, n: 20 },
    recall: [stat('POST_CONVERSATION', 0.8, 20)],
    successfulRetrievals: 0,
    varietyRatio: 0,
    latencyImprovementPct: null,
    interferenceAccuracy: null,
    dividedAttentionGapPoints: null,
    baselinesCompleted: 0,
    ...over,
  }
}

describe('phase gates', () => {
  it('gates phase 0 on completing the instruments, not on performing well on them', () => {
    const notDone = evaluateGate(snapshot({ phase: 0, baselinesCompleted: 3 }))
    expect(notDone.canAdvance).toBe(false)
    expect(evaluateGate(snapshot({ phase: 0, baselinesCompleted: 4 })).canAdvance).toBe(true)
  })

  it('advances out of phase 1 only when adherence, recall, and the habit floor all hold', () => {
    expect(evaluateGate(snapshot()).canAdvance).toBe(true)
  })

  it('holds a keen user back at the habit-formation floor — the one deliberate time gate', () => {
    const keen = evaluateGate(snapshot({ phaseEnteredAt: T0 - 20 * DAY }))
    expect(keen.canAdvance).toBe(false)
    expect(keen.criteria.find((c) => c.id === 'habit-floor')!.met).toBe(false)
  })

  it('marks a criterion insufficient rather than failed when n is too small to judge', () => {
    const thin = evaluateGate(snapshot({ adherence: { rate: 1, n: 3 } }))
    const c = thin.criteria.find((x) => x.id === 'adherence')!
    expect(c.insufficient).toBe(true)
    expect(c.met).toBe(false)
    expect(c.actual).toMatch(/n=3/)
  })

  it('requires volume and image variety, not just recall, to leave phase 2', () => {
    const base = snapshot({
      phase: 2,
      recall: [stat('ONE_WEEK', 0.7, 25), stat('ONE_MONTH', 0.6, 15)],
      successfulRetrievals: 250,
      varietyRatio: 0.7,
    })
    expect(evaluateGate(base).canAdvance).toBe(true)
    expect(evaluateGate({ ...base, varietyRatio: 0.4 }).canAdvance).toBe(false)
    expect(evaluateGate({ ...base, successfulRetrievals: 100 }).canAdvance).toBe(false)
  })

  it('requires the lab-to-life gap to be closed before phase 4', () => {
    const base = snapshot({
      phase: 3,
      recall: [stat('ONE_MONTH', 0.7, 25)],
      latencyImprovementPct: 40,
      interferenceAccuracy: 0.75,
      dividedAttentionGapPoints: 15,
    })
    expect(evaluateGate(base).canAdvance).toBe(true)
    expect(evaluateGate({ ...base, dividedAttentionGapPoints: 35 }).canAdvance).toBe(false)
  })

  it('never completes phase 4, because maintenance does not end', () => {
    const g = evaluateGate(snapshot({ phase: 4 }))
    expect(g.nextPhase).toBeNull()
    expect(g.canAdvance).toBe(false)
  })
})

describe('capability statement', () => {
  it('reports measurements and states what is still not achievable', () => {
    const text = capabilityStatement(
      snapshot({
        recall: [stat('POST_CONVERSATION', 0.85, 30), stat('ONE_WEEK', 0.7, 25)],
        latencyImprovementPct: 35,
      }),
    )
    expect(text).toMatch(/85%/)
    expect(text).toMatch(/35% faster/)
    expect(text).toMatch(/will still fade/)
    expect(text).toMatch(/never become effortless/)
  })

  it('says nothing rather than something flattering when there is no data', () => {
    expect(capabilityStatement(snapshot({ recall: [] }))).toMatch(/Not enough data/)
  })

  it('refuses to state a percentage from a handful of attempts', () => {
    // This sentence is rendered with the app's one drop cap. Before the n gate, a single
    // successful retrieval produced "You hold 100% of names past the end of the conversation".
    const thin = capabilityStatement(snapshot({ recall: [stat('POST_CONVERSATION', 1, 1)] }))
    expect(thin).toMatch(/Not enough data/)
    expect(thin).not.toMatch(/100%/)
  })

  it('carries the sample size in every clause it does state', () => {
    const text = capabilityStatement(
      snapshot({ recall: [stat('POST_CONVERSATION', 0.8, 40), stat('ONE_WEEK', 0.6, 5)] }),
    )
    expect(text).toMatch(/80% of names past the end of the conversation \(n=40\)/)
    // The one-week bucket is below MIN_N, so it contributes nothing rather than a bare figure.
    expect(text).not.toMatch(/60%/)
  })
})

describe('baseline verdict routing', () => {
  const result = (kind: AssessmentResult['kind'], score: number): AssessmentResult => ({
    id: kind,
    at: T0,
    kind,
    score,
    n: 20,
  })

  it('puts perception first: a name never heard is not a memory problem', () => {
    const v = computeVerdict([result('NAME_IN_NOISE', 0.4), result('FACE_NAME', 0.3), result('FACE_INDIVIDUATION', 0.5)])
    expect(v.verdict).toBe('PERCEPTUAL_INPUT')
    expect(v.flags.join(' ')).toMatch(/hearing check/i)
  })

  it('routes to face work when faces are the weak side of the binding', () => {
    const v = computeVerdict([result('NAME_IN_NOISE', 0.9), result('FACE_INDIVIDUATION', 0.5), result('FACE_NAME', 0.4)])
    expect(v.verdict).toBe('FACE_INDIVIDUATION')
  })

  it('routes a fast-enough-but-slow user to fluency work', () => {
    const v = computeVerdict([result('NAME_IN_NOISE', 0.9), result('FACE_INDIVIDUATION', 0.9), result('FACE_NAME', 0.8)])
    expect(v.verdict).toBe('RETRIEVAL_FLUENCY')
  })

  it('defaults to encoding attention — the common case', () => {
    const v = computeVerdict([result('NAME_IN_NOISE', 0.9), result('FACE_INDIVIDUATION', 0.9), result('FACE_NAME', 0.4)])
    expect(v.verdict).toBe('ENCODING_ATTENTION')
    expect(v.reasoning).toMatch(/encoding failure/)
  })

  it('flags lifestyle confounds without diagnosing them', () => {
    const v = computeVerdict([result('CONFOUND_SCREEN', 0.8), result('FACE_NAME', 0.4)])
    expect(v.flags.join(' ')).toMatch(/sleep, stress, or alcohol/)
  })
})

describe('image variety', () => {
  const person: Person = {
    id: 'p1',
    track: 'PERSON',
    displayName: 'Sarah',
    givenName: 'Sarah',
    metAt: T0,
    likelihoodOfMeetingAgain: 'HIGH',
    status: 'ACTIVE',
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
  }
  const img = (id: string, encounterId: string, at = T0): MediaRef => ({
    id,
    personId: 'p1',
    kind: 'IMAGE',
    encounterId,
    capturedAt: at,
    src: '',
  })

  it('does not count a burst from one encounter as face variety', () => {
    const burst = [img('m1', 'e1'), img('m2', 'e1'), img('m3', 'e1')]
    expect(confidenceCeiling(person, burst)).toBe('PHOTO_ONLY')
  })

  it('promotes only when the looks come from different occasions', () => {
    expect(confidenceCeiling(person, [img('m1', 'e1'), img('m2', 'e2')])).toBe('FAMILIAR')
    expect(confidenceCeiling(person, [img('m1', 'e1'), img('m2', 'e2'), img('m3', 'e3')])).toBe('ROBUST')
  })

  it('never serves the same image twice in a row, preferring a different occasion', () => {
    const media = [img('m1', 'e1', T0), img('m2', 'e1', T0 + 1), img('m3', 'e2', T0 + 2)]
    const next = nextDrillImage(person, media, 'm1')
    expect(next!.id).toBe('m3')
    expect(nextDrillImage(person, media, null)!.id).toBe('m1')
    expect(nextDrillImage(person, [img('m1', 'e1')], 'm1')!.id).toBe('m1')
  })

  it('reports coverage across the active roster', () => {
    const other = { ...person, id: 'p2' }
    const media = [img('m1', 'e1'), img('m2', 'e2')]
    const cov = varietyCoverage([person, other], media)
    expect(cov.total).toBe(2)
    expect(cov.covered).toBe(1)
    expect(cov.ratio).toBe(0.5)
  })
})

describe('cue ladder', () => {
  it('eases and hardens without running off either end', () => {
    expect(easeCue('FREE')).toBe('SEMANTIC_CONTEXT')
    expect(easeCue('RESTUDY')).toBe('RESTUDY')
    expect(hardenCue('FREE')).toBe('FREE')
    expect(hardenCue('INITIAL_LETTER')).toBe('SEMANTIC_CONTEXT')
  })

  it('builds cues that constrain without giving the answer away', () => {
    expect(buildCue('FREE', 'Sarah').text).toBe('')
    expect(buildCue('INITIAL_LETTER', 'sarah').text).toMatch(/“S”/)
    expect(buildCue('SYLLABLE_PHONEME', 'Sarah').text).toMatch(/2 syllables/)
    expect(buildCue('SEMANTIC_CONTEXT', 'Sarah', { context: 'Ana’s birthday' }).text).toMatch(/Ana’s birthday/)
  })

  it('makes the four-choice cue a real choice, and keeps it stable across renders', () => {
    const cue = buildCue('FOUR_CHOICE', 'Sarah', { distractors: ['Sadie', 'Sara', 'Sonia', 'Sarah'] })
    expect(cue.choices).toHaveLength(4)
    expect(cue.choices).toContain('Sarah')
    expect(new Set(cue.choices).size).toBe(4)
    expect(buildCue('FOUR_CHOICE', 'Sarah', { distractors: ['Sadie', 'Sara', 'Sonia'] }).choices).toEqual(cue.choices)
  })

  it('counts syllables well enough for a phonological cue', () => {
    expect(syllableCount('Sarah')).toBe(2)
    expect(syllableCount('Bo')).toBe(1)
    expect(syllableCount('Alexandra')).toBe(4)
  })
})

describe('drill unlocks', () => {
  it('reveals drills by phase rather than all at once', () => {
    expect(drillsAvailable(1).length).toBeLessThan(drillsAvailable(3).length)
    expect(drillsAvailable(1).map((d) => d.id)).toContain('NAME_IN_NOISE')
    expect(drillsAvailable(1).map((d) => d.id)).not.toContain('DIVIDED_ATTENTION')
    expect(nextUnlock(1)!.minPhase).toBe(2)
    expect(nextUnlock(4)).toBeNull()
  })
})

describe('daily plan', () => {
  const people: Person[] = Array.from({ length: 3 }, (_, i) => ({
    id: `p${i}`,
    track: 'PERSON',
    displayName: `Person ${i}`,
    givenName: `Person ${i}`,
    metAt: T0 - 10 * DAY,
    likelihoodOfMeetingAgain: 'HIGH',
    status: 'ACTIVE',
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
  }))

  it('offers an amnesty instead of a wall once the backlog is large', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      createItem(`i${i}`, `p${i % 3}`, 'PERSON', 'FACE_TO_NAME', T0 - 30 * DAY, settings),
    ).map((i) => ({ ...i, due: T0 - DAY }))
    const plan = buildDailyPlan(T0, people, many, settings, undefined)
    expect(plan.suggestAmnesty).toBe(true)
    expect(plan.focus).toMatch(/spread them over the next two weeks/i)
  })

  it('says something useful when there is nothing due', () => {
    const plan = buildDailyPlan(T0, [], [], settings, undefined)
    expect(plan.suggestAmnesty).toBe(false)
    expect(plan.focus).toMatch(/Nothing due/)
  })

  it('recognises the pre-sleep window from the configured hour', () => {
    const evening = new Date('2026-03-02T21:30:00').getTime()
    expect(timeOfDay(evening, settings)).toBe('PRE_SLEEP')
    expect(timeOfDay(T0, settings)).toBe('MORNING')
  })

  it('stays silent unless there is a reason to interrupt', () => {
    const quiet = buildDailyPlan(T0, [], [], settings, undefined)
    expect(shouldPrompt(quiet, T0, undefined).fire).toBe(false)

    const items = Array.from({ length: 4 }, (_, i) => ({
      ...createItem(`i${i}`, `p${i % 3}`, 'PERSON', 'FACE_TO_NAME', T0 - 10 * DAY, settings),
      due: T0 - DAY,
    }))
    const busy = buildDailyPlan(T0, people, items, settings, undefined)
    expect(shouldPrompt(busy, T0, undefined).fire).toBe(true)
  })

  it('never interrupts a declared rest day or the small hours', () => {
    const items = [{ ...createItem('i1', 'p0', 'PERSON', 'FACE_TO_NAME', T0 - 10 * DAY, settings), due: T0 - DAY }]
    const plan = buildDailyPlan(T0, people, items, settings, undefined)
    const restDay = {
      day: '2026-03-02',
      retrievalsDue: 5,
      retrievalsDone: 0,
      newPeople: 0,
      namesUsedAloud: 0,
      missionCompleted: false,
      restDay: true,
      freezeUsed: false,
      preSleepReviewDone: false,
    }
    expect(shouldPrompt(plan, T0, restDay).fire).toBe(false)
    expect(shouldPrompt(plan, new Date('2026-03-02T03:00:00').getTime(), undefined).fire).toBe(false)
  })
})
