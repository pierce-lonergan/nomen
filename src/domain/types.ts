/**
 * Core domain types.
 *
 * Everything under `src/domain` is pure and dependency-free: no DOM, no IndexedDB, no clock.
 * Time is always passed in as `now: number` (epoch ms) so that a year-long expanding schedule
 * can be simulated in a millisecond of test time.
 */

export type Id = string

// ── Tracks and retrieval routes ────────────────────────────────────────────────
// Separate modes because they are separate routes through the Bruce & Young flow and they
// dissociate: you can hold a face→name link while the voice→name link is absent.

export type TrackKind = 'PERSON' | 'CAST' | 'PLACE'

export type RetrievalMode =
  | 'FACE_TO_NAME'
  | 'NAME_TO_FACE'
  | 'VOICE_TO_NAME'
  | 'CAST_RECALL'
  | 'PLACE_RECALL'

export const MODES_FOR_TRACK: Record<TrackKind, RetrievalMode[]> = {
  PERSON: ['FACE_TO_NAME', 'NAME_TO_FACE', 'VOICE_TO_NAME'],
  CAST: ['CAST_RECALL'],
  PLACE: ['PLACE_RECALL'],
}

/**
 * Whether a subject is a human being, and therefore whether their name is set in the serif.
 *
 * The visual system reserves one typeface for people and nothing else, which makes the change of
 * face itself the semantic marker: if it is in the serif, it is a person. A character in a novel
 * is a person. **A place is not** — and because CAST, PERSON and PLACE all ride the same `Person`
 * record, that distinction has to be a branch on the data rather than on the component. It lives
 * here, in the domain, so it can be tested without a DOM.
 */
export function isHuman(track: TrackKind): boolean {
  return track === 'PERSON' || track === 'CAST'
}

// ── Grading ───────────────────────────────────────────────────────────────────
// `CUED` is not a partial credit — it is the tip-of-the-tongue state, logged separately
// because TOT frequency is one of the brief's named process metrics.

export type Grade = 'MISS' | 'CUED' | 'GOT' | 'INSTANT'

/** Below this, a retrieval counts as fluent rather than merely correct (Logan 1988). */
export const INSTANT_THRESHOLD_MS = 1500

export type CueLevel =
  | 'FREE'
  | 'SEMANTIC_CONTEXT'
  | 'INITIAL_LETTER'
  | 'SYLLABLE_PHONEME'
  | 'FOUR_CHOICE'
  | 'RESTUDY'

// ── Encoding-side records ─────────────────────────────────────────────────────

/** The four beats of the live micro-protocol. Adherence is the leading process metric. */
export interface ProtocolAdherence {
  heard: boolean
  said: boolean
  looked: boolean
  hooked: boolean
}

export type NoiseLevel = 'QUIET' | 'MODERATE' | 'LOUD'

/**
 * Conditions at the moment of encoding. These are the brief's §9 confounds; logging them is
 * what lets Insights turn "I'm bad with names" into "you're bad with names in bars".
 */
export interface EncounterContext {
  noise: NoiseLevel
  alcohol: boolean
  /** 1 = fully rested … 5 = exhausted */
  fatigue: number
  /** 1 = calm … 5 = highly stressed (social anxiety at introductions is doubly costly) */
  stress: number
  setting: string
}

export interface Encounter {
  id: Id
  at: number
  context: EncounterContext
  adherence: ProtocolAdherence
  /** Media captured during *this* encounter. Distinct encounters are what create face variety. */
  mediaIds: Id[]
  note?: string
}

export type MeetAgainLikelihood = 'LOW' | 'MEDIUM' | 'HIGH'

/** Roster = met but not yet promoted into active rotation (intake cap). Nothing is ever lost. */
export type PersonStatus = 'ROSTER' | 'ACTIVE' | 'ARCHIVED'

export interface Person {
  id: Id
  track: TrackKind
  /** What you'd say out loud. For CAST/PLACE this is the character or toponym. */
  displayName: string
  givenName: string
  familyName?: string
  /** How it actually sounds — the acoustic record, filled in when you ask for a repeat. */
  phonetic?: string
  /** One lightweight semantic association. Five words. Not a memory palace. */
  hook?: string
  /** Where you met / what work this character does / what region this place is in. */
  context?: string
  metAt: number
  likelihoodOfMeetingAgain: MeetAgainLikelihood
  status: PersonStatus
  /** Flagged for the offline imagery workshop — deliberately a small set. */
  highValue: boolean
  encounters: Encounter[]
  imageMediaIds: Id[]
  voiceMediaIds: Id[]
  /** CAST only: who they are in the story. Situation-model support. */
  role?: string
  /** CAST/PLACE only: the work or the region this belongs to. */
  collection?: string
  archivedAt?: number
}

export interface MediaRef {
  id: Id
  personId: Id
  kind: 'IMAGE' | 'AUDIO'
  encounterId: Id
  capturedAt: number
  /** Object URL / data URL. Blobs live in the media store; never leaves the device. */
  src: string
}

// ── Scheduling ────────────────────────────────────────────────────────────────

export interface ScheduleItem {
  id: Id
  subjectId: Id
  track: TrackKind
  mode: RetrievalMode
  /** Index into the active ladder. */
  rung: number
  due: number
  lastReviewedAt: number | null
  reps: number
  lapses: number
  /**
   * The easiest cue that must be *offered before* the attempt (errorless fallback).
   * `FREE` means normal errorful-with-feedback retrieval, which is the default for healthy adults.
   */
  cueFloor: CueLevel
  createdAt: number
  suspended: boolean
  /** ≥3 lapses: the record is broken, not the memory. Route to re-encoding, not more drilling. */
  needsReencoding: boolean
}

export interface Attempt {
  id: Id
  itemId: Id
  subjectId: Id
  mode: RetrievalMode
  at: number
  grade: Grade
  latencyMs: number
  cueUsed: CueLevel
  /** Elapsed time since the person was first met — the axis for recall@delay. */
  delaySinceEncodingMs: number
  /** True when performed under the divided-attention drill (Phase 3 transfer work). */
  dividedAttention: boolean
  /** True when the item was scheduled to lapse and was saved — drives the Rescue reward. */
  wasRescue: boolean
}

// ── Program ───────────────────────────────────────────────────────────────────

export type Phase = 0 | 1 | 2 | 3 | 4

export type BaselineVerdict =
  | 'ENCODING_ATTENTION'
  | 'PERCEPTUAL_INPUT'
  | 'FACE_INDIVIDUATION'
  | 'RETRIEVAL_FLUENCY'

export interface AssessmentResult {
  id: Id
  at: number
  kind: 'FACE_NAME' | 'FACE_INDIVIDUATION' | 'NAME_IN_NOISE' | 'CONFOUND_SCREEN'
  /** Proportion correct, 0..1. For CONFOUND_SCREEN this is a normalised risk score. */
  score: number
  n: number
  detail?: Record<string, number | string | boolean>
}

// ── Engagement ────────────────────────────────────────────────────────────────

/** One row per local calendar day. The streak is computed from these, never stored raw. */
export interface DayRecord {
  /** `YYYY-MM-DD` in local time. */
  day: string
  retrievalsDue: number
  retrievalsDone: number
  newPeople: number
  namesUsedAloud: number
  missionCompleted: boolean
  /** Declared in advance; does not consume a freeze. */
  restDay: boolean
  freezeUsed: boolean
  preSleepReviewDone: boolean
  sleepHours?: number
}

export interface StreakState {
  current: number
  longest: number
  freezesHeld: number
  /** Lifetime successful retrievals — the number shown under a broken streak. */
  lifetimeRetrievals: number
  lastCountedDay: string | null
}

export type RewardKind =
  | 'RESCUE'
  | 'DURABILITY_RECORD'
  | 'FIELD_WIN'
  | 'FREEZE_EARNED'
  | 'PHASE_UNLOCK'
  | 'DRILL_UNLOCK'

export interface RewardEvent {
  kind: RewardKind
  at: number
  headline: string
  /** The true fact behind the reward. Nomen has no rewards that aren't measurements. */
  detail: string
  subjectId?: Id
}

export interface Mission {
  id: Id
  day: string
  kind: 'USE_NAME_ALOUD' | 'ASK_SPELLING' | 'PROTOCOL_STREAK' | 'RECONFIRM' | 'HIGH_STAKES'
  target: number
  progress: number
  text: string
  completed: boolean
}

/** The Moment Journal: the real-world payoff, self-reported. The month-nine motivator. */
export interface Moment {
  id: Id
  at: number
  subjectId?: Id
  text: string
  feeling: 'GOOD' | 'GREAT' | 'RELIEF'
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface Settings {
  /** Expanding is the default; uniform is offered because the literature is unresolved. */
  scheduleMode: 'expanding' | 'uniform'
  intakeCapPerDay: number
  dailyRetrievalCeiling: number
  /** Local hour (0–23) for the pre-sleep consolidation slot. */
  preSleepHour: number
  restDaysPerWeek: number
  phase: Phase
  phaseEnteredAt: number
  baselineVerdict?: BaselineVerdict
  /** Explicitly opted into voice capture; recording is never silent. */
  voiceCaptureEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  scheduleMode: 'expanding',
  intakeCapPerDay: 5,
  dailyRetrievalCeiling: 25,
  preSleepHour: 22,
  restDaysPerWeek: 1,
  phase: 0,
  phaseEnteredAt: 0,
  voiceCaptureEnabled: false,
}
