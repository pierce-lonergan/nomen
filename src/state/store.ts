import { create } from 'zustand'
import type {
  AssessmentResult,
  Attempt,
  CueLevel,
  DayRecord,
  EncounterContext,
  Grade,
  MediaRef,
  MeetAgainLikelihood,
  Mission,
  Moment,
  Person,
  ProtocolAdherence,
  RewardEvent,
  ScheduleItem,
  Settings,
  TrackKind,
} from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'
import { modesForSubject } from '../domain/drills/registry'
import { dayKey } from '../domain/time'
import { applyGrade, createItem } from '../domain/scheduler/schedule'
import { amnesty, promotedOn } from '../domain/scheduler/loadBalancer'
import { rewardsForAttempt } from '../domain/engagement/rewards'
import { advanceMission, missionForDay } from '../domain/engagement/missions'
import { buildDailyPlan, type DailyPlan } from '../domain/program/dailyPlan'
import { computeStreak, type StreakComputation } from '../domain/engagement/streak'
import { evaluateGate, type GateEvaluation, type ProgramSnapshot } from '../domain/program/gates'
import { recallAtDelay, successRate } from '../domain/metrics/recall'
import { adherenceRate } from '../domain/metrics/confounds'
import { dividedAttentionGap } from '../domain/metrics/recall'
import { fitPowerLaw, latencyImprovement, successfulLatencies } from '../domain/metrics/latency'
import { varietyCoverage } from '../domain/faceVariety'
import * as repo from '../data/db'

/**
 * The single orchestration layer.
 *
 * All decisions are made by pure functions in `src/domain`; this store only moves data between
 * them and IndexedDB, and holds the small amount of genuinely ephemeral view state.
 */

export interface CaptureDraft {
  givenName: string
  familyName?: string
  phonetic?: string
  hook?: string
  setting: string
  likelihoodOfMeetingAgain: MeetAgainLikelihood
  adherence: ProtocolAdherence
  context: EncounterContext
  track?: TrackKind
  role?: string
  collection?: string
  imageBlobs?: Blob[]
}

interface NomenState {
  loaded: boolean
  people: Person[]
  media: MediaRef[]
  items: ScheduleItem[]
  attempts: Attempt[]
  days: DayRecord[]
  missions: Mission[]
  moments: Moment[]
  assessments: AssessmentResult[]
  settings: Settings
  /** Rewards produced by the most recent grading, consumed by the UI then cleared. */
  pendingRewards: RewardEvent[]

  load: () => Promise<void>
  capture: (draft: CaptureDraft, now: number) => Promise<Person>
  addEncounter: (personId: string, draft: Pick<CaptureDraft, 'setting' | 'adherence' | 'context' | 'imageBlobs'>, now: number) => Promise<void>
  grade: (itemId: string, grade: Grade, latencyMs: number, cueUsed: CueLevel, dividedAttention: boolean, now: number) => Promise<void>
  promote: (people: Person[]) => Promise<void>
  runAmnesty: (days: number, now: number) => Promise<void>
  logMoment: (text: string, feeling: Moment['feeling'], subjectId: string | undefined, now: number) => Promise<void>
  logNameUsedAloud: (now: number) => Promise<void>
  markRestDay: (now: number, rest: boolean) => Promise<void>
  markPreSleepDone: (now: number) => Promise<void>
  recordAssessment: (result: AssessmentResult) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  advancePhase: (now: number) => Promise<void>
  addVoiceClip: (personId: string, blob: Blob, durationMs: number, now: number) => Promise<void>
  removePerson: (personId: string) => Promise<void>
  clearRewards: () => void
  replaceAll: (bundle: repo.ExportBundle) => Promise<void>
}

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}-${Date.now()}`)

function emptyDay(day: string): DayRecord {
  return {
    day,
    retrievalsDue: 0,
    retrievalsDone: 0,
    newPeople: 0,
    namesUsedAloud: 0,
    missionCompleted: false,
    restDay: false,
    freezeUsed: false,
    preSleepReviewDone: false,
  }
}

export const useStore = create<NomenState>((set, get) => ({
  loaded: false,
  people: [],
  media: [],
  items: [],
  attempts: [],
  days: [],
  missions: [],
  moments: [],
  assessments: [],
  settings: DEFAULT_SETTINGS,
  pendingRewards: [],

  async load() {
    const d = await repo.db()
    set({
      people: await d.getAll('people'),
      media: await d.getAll('media'),
      items: await d.getAll('items'),
      attempts: await d.getAll('attempts'),
      days: await d.getAll('days'),
      missions: await d.getAll('missions'),
      moments: await d.getAll('moments'),
      assessments: await d.getAll('assessments'),
      settings: await repo.loadSettings(),
      loaded: true,
    })

    // Convert any base64 media left by v0.1, a slice at a time and after first paint. Anything not
    // yet converted still displays — `mediaSrc()` falls back to the legacy string — so this is a
    // storage upgrade the user never sees, rather than a blocking migration on launch.
    void (async () => {
      let guard = 0
      while ((await repo.migrateLegacyMedia()) > 0 && guard++ < 200) {
        await new Promise((r) => setTimeout(r, 0))
      }
      if (guard > 0) set({ media: await (await repo.db()).getAll('media') })
    })()
  },

  async capture(draft, now) {
    const { settings, people } = get()
    const track = draft.track ?? 'PERSON'
    const encounterId = uid()
    const day = dayKey(now)

    // Intake cap: beyond the day's allowance, a new person lands on the roster with their record
    // intact rather than becoming an active item. This is the anti-review-debt rule.
    const promotedToday = promotedOn(people, day)
    const status = promotedToday < settings.intakeCapPerDay ? 'ACTIVE' : 'ROSTER'

    const media: MediaRef[] = (draft.imageBlobs ?? []).map((blob) => ({
      id: uid(),
      personId: '',
      kind: 'IMAGE' as const,
      encounterId,
      capturedAt: now,
      blob,
    }))

    const person: Person = {
      id: uid(),
      track,
      displayName: [draft.givenName, draft.familyName].filter(Boolean).join(' ').trim(),
      givenName: draft.givenName,
      familyName: draft.familyName,
      phonetic: draft.phonetic,
      hook: draft.hook,
      context: draft.setting,
      metAt: now,
      likelihoodOfMeetingAgain: draft.likelihoodOfMeetingAgain,
      status,
      promotedAt: status === 'ACTIVE' ? now : undefined,
      highValue: draft.likelihoodOfMeetingAgain === 'HIGH',
      role: draft.role,
      collection: draft.collection,
      encounters: [
        { id: encounterId, at: now, context: draft.context, adherence: draft.adherence, mediaIds: media.map((m) => m.id) },
      ],
      imageMediaIds: media.map((m) => m.id),
      voiceMediaIds: [],
    }
    for (const m of media) m.personId = person.id

    // Every mode that is unlocked at this phase AND has something to work with. At Phase 1 that is
    // exactly one item, so a new person is still one line in the queue; the extra routes arrive
    // when their drill genuinely opens.
    const items = modesForSubject(track, settings.phase, media.length > 0).map((mode) =>
      createItem(uid(), person.id, track, mode, now, settings),
    )

    const today = { ...(get().days.find((x) => x.day === day) ?? emptyDay(day)) }
    today.newPeople += 1

    // A person, their photographs, their schedule and the day's tally are one fact about one
    // introduction. Half of it is worse than none of it.
    await repo.transact([
      { store: 'people', values: [person] },
      { store: 'media', values: media },
      { store: 'items', values: status === 'ACTIVE' ? items : [] },
      { store: 'days', values: [today] },
    ])

    set((s) => ({
      people: [...s.people, person],
      media: [...s.media, ...media],
      items: status === 'ACTIVE' ? [...s.items, ...items] : s.items,
      days: [...s.days.filter((x) => x.day !== day), today],
    }))
    return person
  },

  async addEncounter(personId, draft, now) {
    const person = get().people.find((p) => p.id === personId)
    if (!person) return
    const encounterId = uid()
    const media: MediaRef[] = (draft.imageBlobs ?? []).map((blob) => ({
      id: uid(),
      personId,
      kind: 'IMAGE' as const,
      encounterId,
      capturedAt: now,
      blob,
    }))
    const updated: Person = {
      ...person,
      encounters: [
        ...person.encounters,
        { id: encounterId, at: now, context: draft.context, adherence: draft.adherence, mediaIds: media.map((m) => m.id) },
      ],
      imageMediaIds: [...person.imageMediaIds, ...media.map((m) => m.id)],
    }
    await repo.transact([
      { store: 'people', values: [updated] },
      { store: 'media', values: media },
    ])
    set((s) => ({
      people: s.people.map((p) => (p.id === personId ? updated : p)),
      media: [...s.media, ...media],
    }))
  },

  async grade(itemId, grade, latencyMs, cueUsed, dividedAttention, now) {
    const { items, people, attempts, settings, missions } = get()
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const person = people.find((p) => p.id === item.subjectId)

    const outcome = applyGrade(item, grade, now, settings)
    const previousBest = attempts
      .filter((a) => a.subjectId === item.subjectId)
      .reduce((max, a) => Math.max(max, a.delaySinceEncodingMs), 0)

    const attempt: Attempt = {
      id: uid(),
      itemId,
      subjectId: item.subjectId,
      mode: item.mode,
      at: now,
      grade,
      latencyMs,
      cueUsed,
      delaySinceEncodingMs: person ? now - person.metAt : 0,
      dividedAttention,
      wasRescue: outcome.wasRescue,
    }

    const rewards = rewardsForAttempt({
      attempt,
      item: outcome.item,
      person,
      intervalCleared: outcome.intervalCleared,
      previousBestInterval: previousBest,
    })

    const day = dayKey(now)
    const today = { ...(get().days.find((x) => x.day === day) ?? emptyDay(day)) }
    today.retrievalsDone += 1
    today.retrievalsDue = Math.max(today.retrievalsDue, today.retrievalsDone)

    // A retrieval feeds the mission when the mission is about retrieval rather than field use.
    const mission = missions.find((m) => m.day === day)
    const updatedMission =
      mission && !mission.completed && mission.kind === 'RECONFIRM' && grade !== 'MISS'
        ? advanceMission(mission)
        : mission

    // ONE transaction. As four separate writes, a crash between any two left an attempt recorded
    // against an item whose interval never advanced — silently corrupting both the schedule and
    // the recall metrics, with no error raised anywhere.
    await repo.transact([
      { store: 'items', values: [outcome.item] },
      { store: 'attempts', values: [attempt] },
      { store: 'days', values: [today] },
      {
        store: 'missions',
        values: updatedMission && updatedMission !== mission ? [updatedMission] : [],
      },
    ])

    set((s) => ({
      items: s.items.map((i) => (i.id === itemId ? outcome.item : i)),
      attempts: [...s.attempts, attempt],
      days: [...s.days.filter((x) => x.day !== day), today],
      missions: updatedMission ? [...s.missions.filter((m) => m.id !== updatedMission.id), updatedMission] : s.missions,
      pendingRewards: rewards,
    }))
  },

  async promote(toPromote) {
    const { settings, items } = get()
    const now = Date.now()
    const { media } = get()
    const newItems = toPromote.flatMap((p) =>
      modesForSubject(p.track, settings.phase, media.some((m) => m.personId === p.id && m.kind === 'IMAGE')).map(
        (mode) => createItem(uid(), p.id, p.track, mode, now, settings),
      ),
    )
    await repo.transact([
      { store: 'people', values: toPromote },
      { store: 'items', values: newItems },
    ])
    set((s) => ({
      people: s.people.map((p) => toPromote.find((q) => q.id === p.id) ?? p),
      items: [...items, ...newItems],
    }))
  },

  async runAmnesty(days, now) {
    const { items, settings } = get()
    const rescheduled = amnesty(items, now, days, settings)
    await repo.putAll('items', rescheduled)
    set({ items: rescheduled })
  },

  async logMoment(text, feeling, subjectId, now) {
    const moment: Moment = { id: uid(), at: now, text, feeling, subjectId }
    await repo.putAll('moments', [moment])
    set((s) => ({ moments: [...s.moments, moment] }))
  },

  async logNameUsedAloud(now) {
    const day = dayKey(now)
    const today = { ...(get().days.find((x) => x.day === day) ?? emptyDay(day)) }
    today.namesUsedAloud += 1

    const { missions, settings, people, items } = get()
    const mission = missions.find((m) => m.day === day) ?? missionForDay(now, settings.phase, people, items)
    const advanced =
      mission.kind === 'USE_NAME_ALOUD' || mission.kind === 'RECONFIRM' ? advanceMission(mission) : mission
    today.missionCompleted = advanced.completed

    await repo.transact([
      { store: 'days', values: [today] },
      { store: 'missions', values: [advanced] },
    ])
    set((s) => ({
      days: [...s.days.filter((x) => x.day !== day), today],
      missions: [...s.missions.filter((m) => m.id !== advanced.id), advanced],
    }))
  },

  async markRestDay(now, rest) {
    const day = dayKey(now)
    const today = { ...(get().days.find((x) => x.day === day) ?? emptyDay(day)), restDay: rest }
    await repo.putAll('days', [today])
    set((s) => ({ days: [...s.days.filter((x) => x.day !== day), today] }))
  },

  async markPreSleepDone(now) {
    const day = dayKey(now)
    const today = { ...(get().days.find((x) => x.day === day) ?? emptyDay(day)), preSleepReviewDone: true }
    await repo.putAll('days', [today])
    set((s) => ({ days: [...s.days.filter((x) => x.day !== day), today] }))
  },

  async recordAssessment(result) {
    await repo.putAll('assessments', [result])
    set((s) => ({ assessments: [...s.assessments, result] }))
  },

  async updateSettings(patch) {
    const settings = { ...get().settings, ...patch }
    await repo.saveSettings(settings)
    set({ settings })
  },

  /**
   * Advance a phase, and BACKFILL the drills that just opened.
   *
   * Without the backfill an unlock is a placard. Existing active people were scheduled under the
   * old phase, so reaching Phase 2 would announce Name → Face and leave every queue untouched —
   * which is the defect this whole change exists to close. New modes are created only for people
   * who can support them, and only where the item does not already exist.
   */
  async advancePhase(now) {
    const { settings, people, items, media } = get()
    const next = Math.min(4, settings.phase + 1) as Settings['phase']
    await get().updateSettings({ phase: next, phaseEnteredAt: now })

    const existing = new Set(items.map((i) => `${i.subjectId}:${i.mode}`))
    const backfill = people
      .filter((p) => p.status === 'ACTIVE')
      .flatMap((p) =>
        modesForSubject(p.track, next, media.some((m) => m.personId === p.id && m.kind === 'IMAGE'))
          .filter((mode) => !existing.has(`${p.id}:${mode}`))
          .map((mode) => createItem(uid(), p.id, p.track, mode, now, settings)),
      )
    if (backfill.length === 0) return

    await repo.putAll('items', backfill)
    set((s) => ({ items: [...s.items, ...backfill] }))
  },

  /**
   * Attach a voice clip. Opt-in twice over — globally in settings and per person at the control —
   * and it also mints the Voice → Name schedule item, because a drill with nothing to test against
   * must not appear in the queue.
   */
  async addVoiceClip(personId, blob, durationMs, now) {
    const { people, items, settings } = get()
    const person = people.find((p) => p.id === personId)
    if (!person) return

    const media: MediaRef = {
      id: uid(),
      personId,
      kind: 'AUDIO',
      encounterId: person.encounters[person.encounters.length - 1]?.id ?? uid(),
      capturedAt: now,
      blob,
      durationMs,
    }
    const updated: Person = { ...person, voiceMediaIds: [...person.voiceMediaIds, media.id] }

    // First clip only: the route opens once, not once per recording.
    const alreadyScheduled = items.some((i) => i.subjectId === personId && i.mode === 'VOICE_TO_NAME')
    const newItems =
      !alreadyScheduled && person.status === 'ACTIVE'
        ? [createItem(uid(), personId, person.track, 'VOICE_TO_NAME', now, settings)]
        : []

    await repo.transact([
      { store: 'people', values: [updated] },
      { store: 'media', values: [media] },
      { store: 'items', values: newItems },
    ])
    set((st) => ({
      people: st.people.map((p) => (p.id === personId ? updated : p)),
      media: [...st.media, media],
      items: [...st.items, ...newItems],
    }))
  },

  async removePerson(personId) {
    await repo.deletePersonCascade(personId)
    set((s) => ({
      people: s.people.filter((p) => p.id !== personId),
      media: s.media.filter((m) => m.personId !== personId),
      items: s.items.filter((i) => i.subjectId !== personId),
      attempts: s.attempts.filter((a) => a.subjectId !== personId),
    }))
  },

  clearRewards() {
    set({ pendingRewards: [] })
  },

  async replaceAll(bundle) {
    await repo.importAll(bundle)
    await get().load()
  },
}))

// ── Derived selectors ─────────────────────────────────────────────────────────

export function selectPlan(state: NomenState, now: number): DailyPlan {
  const today = state.days.find((d) => d.day === dayKey(now))
  return buildDailyPlan(now, state.people, state.items, state.settings, today)
}

export function selectStreak(state: NomenState, now: number): StreakComputation {
  return computeStreak(state.days, now)
}

export function selectSnapshot(state: NomenState, now: number): ProgramSnapshot {
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000
  const latencies = successfulLatencies(state.attempts)
  const improvement = latencyImprovement(latencies)
  const interference = successRate(state.attempts.filter((a) => a.cueUsed === 'FOUR_CHOICE'))

  return {
    now,
    phase: state.settings.phase,
    phaseEnteredAt: state.settings.phaseEnteredAt || now,
    adherence: adherenceRate(state.people, fourteenDaysAgo),
    recall: recallAtDelay(state.attempts),
    successfulRetrievals: state.attempts.filter((a) => a.grade === 'GOT' || a.grade === 'INSTANT').length,
    varietyRatio: varietyCoverage(state.people, state.media).ratio,
    latencyImprovementPct: improvement?.percentFaster ?? null,
    interferenceAccuracy: interference.n >= 10 ? interference.rate : null,
    dividedAttentionGapPoints: dividedAttentionGap(state.attempts).gapPoints,
    baselinesCompleted: new Set(state.assessments.map((a) => a.kind)).size,
  }
}

export function selectGate(state: NomenState, now: number): GateEvaluation {
  return evaluateGate(selectSnapshot(state, now))
}

export function selectLatencyFit(state: NomenState) {
  return fitPowerLaw(successfulLatencies(state.attempts))
}
