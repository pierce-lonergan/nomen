import type { Grade, Person, ScheduleItem, Settings } from '../types'
import { INSTANT_THRESHOLD_MS } from '../types'
import { MINUTE, dayKey, stableUnitHash } from '../time'
import { atRiskItems, dueItems } from '../scheduler/schedule'

/**
 * The Long Room — run planning.
 *
 * Pure, clock-free, and testable, like everything else under `domain/`. The screen renders what
 * this file decides; it decides nothing itself.
 *
 * ── WHAT THIS MODE IS, AND WHAT IT IS NOT ────────────────────────────────────────────────────
 *
 * It is an **adherence** feature. It is not a learning feature and must never be described as one.
 * The 3D crowd exists for pacing and target-selection load — the sculpted heads are strangers to
 * walk past, not faces to learn. The research is unambiguous and points the other way: synthesised
 * viewpoint variation of a single identity was tested directly against a single static image and
 * returned Bayes factors of 0.40 and 0.52 *for the null* (Matthews et al. 2024). The mechanism that
 * does work needs photographs from genuinely different days, which is a content problem.
 *
 * So the entertainment budget is spent where the gamification meta-analyses actually support it —
 * game fiction and difficulty calibration — and nowhere near a token economy.
 *
 * ── THE ONE THAT WOULD HAVE BEEN A DESIGN HOLE ───────────────────────────────────────────────
 *
 * Being wrong is free and only inaction ends a run, which invites an obvious degenerate strategy:
 * claim every card the instant it becomes legible, never touch the rail, take whatever falls out.
 *
 * That strategy is not blocked, and blocking it would require punishing wrong answers — the single
 * largest undermining contingency in the reward literature (d ≈ −0.88 for signalling sub-maximal
 * performance). It is instead **self-defeating in the domain**: a blind claim resolves to MISS,
 * MISS drops the item two rungs, and tomorrow's queue is longer for it. The cost is real, it is
 * the truth, and the app states it in the room rather than hiding it in a scoring rule.
 */

// ── Claims ────────────────────────────────────────────────────────────────────────────────────

/**
 * What the player did with a card before it went past.
 *
 * `PASSED` deliberately produces **no attempt at all**. Nothing was retrieved, so recording a MISS
 * would be inventing data — and it would make quitting mid-run cost something, which is the
 * completion contingency (d ≈ −0.36) this design is required to avoid.
 */
export type ClaimKind = 'COLD' | 'RAILED' | 'PASSED'

export interface Claim {
  itemId: string
  subjectId: string
  kind: ClaimKind
  /** Milliseconds from the card becoming legible to the claim gesture. */
  latencyMs: number
  /** True when a second card was inside its own window at the same moment. */
  dividedAttention: boolean
}

/**
 * The grade a claim resolves to, once the cascade has asked "did you have it?".
 *
 * Returns `null` for a pass — no attempt happened, so no attempt is written.
 */
export function gradeForClaim(claim: Claim, held: boolean): Grade | null {
  if (claim.kind === 'PASSED') return null
  if (!held) return 'MISS'
  // Pulling the rail is the cue ladder made physical, and the app already treats a cued retrieval
  // as a tip-of-the-tongue rather than a success. That is what gives the rail a real price.
  if (claim.kind === 'RAILED') return 'CUED'
  return claim.latencyMs <= INSTANT_THRESHOLD_MS ? 'INSTANT' : 'GOT'
}

// ── Duration as the amplitude channel ─────────────────────────────────────────────────────────

/**
 * The silent hold before a reveal, scaled to what the item is genuinely worth.
 *
 * Hit-stop, translated for a typographic app. The visual system has no glow, no burst and no
 * scale, so *time* is the only emphasis channel left open — and unlike a particle effect it is
 * bound to a true measured quantity, which makes it informational feedback rather than decoration.
 * A two-minute item gets nothing. One held for three months gets four tenths of a second of
 * silence, and that silence is the loudest thing in the app.
 */
export const MAX_HOLD_MS = 400

/**
 * The span the hold is normalised across: one minute to the top of the ladder, six months.
 *
 * Getting this wrong is silent and total. A fixed coefficient per octave — 40ms was the first
 * attempt — saturates the cap at around one day, which means every interval from a day to half a
 * year receives an identical hold and the channel carries no information at all. Normalising
 * against the real range is what keeps a week distinguishable from three weeks.
 */
const HOLD_SPAN_OCTAVES = Math.log2((180 * 24 * 60 * MINUTE) / MINUTE)

export function holdMsFor(intervalClearedMs: number): number {
  if (intervalClearedMs <= MINUTE) return 0
  const t = Math.log2(intervalClearedMs / MINUTE) / HOLD_SPAN_OCTAVES
  return Math.round(MAX_HOLD_MS * Math.min(1, Math.max(0, t)))
}

// ── The pitch ladder ──────────────────────────────────────────────────────────────────────────

/** Major pentatonic. No semitones, so two overlapping decay tails can never clash. */
const PENTATONIC = [0, 2, 4, 7, 9]

export const PITCH_FLOOR_HZ = 400
export const PITCH_CEIL_HZ = 1600

/**
 * The frequency for the nth confirmation in a room.
 *
 * Register-capped, because an uncapped ascending combo climbs into the ear's most fatiguing band
 * and the reward mechanic starts punishing the behaviour it exists to encourage — a failure that
 * never shows up in a short test and arrives reliably in week two. At the ceiling it drops an
 * octave while the root shifts, so the harmonic change masks the reset and it still reads as rise.
 */
export function ladderHz(rootHz: number, step: number): number {
  const degree = PENTATONIC[step % PENTATONIC.length]
  const octave = Math.floor(step / PENTATONIC.length)
  let hz = rootHz * Math.pow(2, degree / 12 + octave)
  while (hz > PITCH_CEIL_HZ) hz /= 2
  while (hz < PITCH_FLOOR_HZ) hz *= 2
  return hz
}

/** The session's root note, re-seeded daily. One line, and it is the best anti-fatigue measure available. */
export function rootHzForDay(now: number): number {
  const semitone = Math.floor(stableUnitHash(`root:${dayKey(now)}`) * 7)
  return 440 * Math.pow(2, (semitone - 3) / 12)
}

// ── Rooms ─────────────────────────────────────────────────────────────────────────────────────

export interface RoomShape {
  /** How many of the player's own people appear in this room. */
  targets: number
  /** Sculpted strangers — occluders, and the categorical foil population. */
  busts: number
  /** How long a card stays claimable once it is legible. */
  windowMs: number
  /** The rail extends itself after this long. `null` means you must reach for it. */
  railAutoMs: number | null
  /** Names in the rail that belong to nobody in this room, so elimination never yields certainty. */
  foils: number
}

/**
 * Six knobs moving together, which is what makes escalation feel like escalation rather than like
 * a number going up: density, speed, cue withdrawal, foil count, occlusion, and batch size.
 */
export const ROOM_SHAPES: RoomShape[] = [
  { targets: 2, busts: 3, windowMs: 5000, railAutoMs: 3500, foils: 0 },
  { targets: 3, busts: 6, windowMs: 4400, railAutoMs: 3000, foils: 0 },
  { targets: 3, busts: 10, windowMs: 3800, railAutoMs: 2600, foils: 2 },
  { targets: 4, busts: 14, windowMs: 3400, railAutoMs: null, foils: 2 },
  { targets: 4, busts: 18, windowMs: 3000, railAutoMs: null, foils: 3 },
]

export interface RoomPlan extends RoomShape {
  index: number
  itemIds: string[]
  /** Seeds for this room's sculpted crowd. Stable within a run, different every night. */
  bustSeed: string
}

export interface RunPlan {
  rooms: RoomPlan[]
  /**
   * The last room: one person, no crowd, no window, no rail.
   *
   * Drawn from `atRiskItems()` — the single person you are genuinely closest to losing. The stake
   * is a measured fact rather than a manufactured one, it is different every night because the
   * queue is, and after five rooms of escalation the mechanics are all *removed* for it. Escalate,
   * escalate, escalate, then silence.
   */
  bossItemId: string | null
  /** The premise line's raw material. The screen writes the sentence; the domain supplies truth. */
  bossDaysOverdue: number
  totalTargets: number
}

/** Below this the mode does not exist: a room of three is not a room, and triage needs a crowd. */
export const MIN_ROSTER_FOR_GALLERY = 12

export interface Availability {
  available: boolean
  activePeople: number
  reason: string
}

export function galleryAvailability(people: Person[]): Availability {
  const active = people.filter((p) => p.status === 'ACTIVE' && p.track === 'PERSON').length
  if (active >= MIN_ROSTER_FOR_GALLERY) {
    return { available: true, activePeople: active, reason: '' }
  }
  return {
    available: false,
    activePeople: active,
    // Stated as a specification rather than a dimmed prize, per the drills convention.
    reason: `The Long Room needs ${MIN_ROSTER_FOR_GALLERY} people in rotation before it is a room rather than a corridor with three plinths. You have ${active}.`,
  }
}

/**
 * Build tonight's run from the real queue.
 *
 * Corridor length is a function of genuine workload — a night with forty due items gets a longer
 * walk than one with twelve — so difficulty tracks what is actually owed instead of a fudge factor.
 */
export function planRun(
  items: ScheduleItem[],
  people: Person[],
  now: number,
  settings: Settings,
): RunPlan {
  const day = dayKey(now)
  const personIds = new Set(
    people.filter((p) => p.track === 'PERSON' && p.status === 'ACTIVE').map((p) => p.id),
  )
  const due = dueItems(items, now).filter((i) => personIds.has(i.subjectId))

  // The boss is chosen first and then withheld from the rooms, so the person you were promised at
  // the door cannot turn up in room two.
  const risk = atRiskItems(items, now, settings).filter((i) => personIds.has(i.subjectId))
  const boss = risk[0] ?? due[due.length - 1] ?? null
  const pool = due.filter((i) => i.id !== boss?.id)

  // Value-first, so a short run still spends its cards on what matters. Ties break on id, never on
  // array order, so the plan is stable across reloads.
  const ordered = [...pool].sort((a, b) => {
    const overdue = now - a.due - (now - b.due)
    return overdue !== 0 ? -overdue : a.id.localeCompare(b.id)
  })

  const rooms: RoomPlan[] = []
  let cursor = 0
  for (let i = 0; i < ROOM_SHAPES.length && cursor < ordered.length; i++) {
    const shape = ROOM_SHAPES[i]
    const slice = ordered.slice(cursor, cursor + shape.targets)
    if (slice.length === 0) break
    cursor += slice.length
    rooms.push({
      ...shape,
      index: i,
      itemIds: slice.map((s) => s.id),
      bustSeed: `${day}:room${i}:${slice[0].id}`,
    })
  }

  const bossDaysOverdue = boss ? Math.max(0, Math.floor((now - boss.due) / (24 * 60 * MINUTE))) : 0

  return {
    rooms,
    bossItemId: boss?.id ?? null,
    bossDaysOverdue,
    totalTargets: rooms.reduce((n, r) => n + r.itemIds.length, 0) + (boss ? 1 : 0),
  }
}

// ── The shortening rule ───────────────────────────────────────────────────────────────────────

/** Three people may walk past you unattended. The fourth closes the room. */
export const PASSES_ALLOWED = 3

/**
 * How much of the app's own 16px left rule survives.
 *
 * The health bar is the design system's structural atom, shortened in discrete steps. No number,
 * no colour, no counter, no easing — and it dies at the run boundary, so it is a state, not a
 * possession. A meter that fills would be a charter violation; a rule that gets shorter is a
 * true statement that three people walked past you.
 */
export function ruleFraction(passes: number): number {
  return Math.max(0, (PASSES_ALLOWED - passes) / PASSES_ALLOWED)
}

export function runIsOver(passes: number): boolean {
  return passes >= PASSES_ALLOWED
}
