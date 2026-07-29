import { stableUnitHash } from '../../domain/time'

/**
 * Bust identity — the parameter space the gallery's sculpted strangers are drawn from.
 *
 * WHAT THESE ARE FOR, STATED PLAINLY, BECAUSE IT IS EASY TO GET WRONG:
 *
 * These heads are **the crowd**. They are the strangers you walk past in the Long Room, and they
 * are the foil population in the face-individuation instrument. They are *not* a way of learning a
 * real person's face, and nothing in this app may ever claim they are.
 *
 * That is not caution, it is a measured result. Matthews, Ritchie, Laurence & Mondloch (2024)
 * tested the closest available analogue — a low-variability set of six frames from one capture,
 * explicitly including changes in viewpoint and expression — against a single static image, and
 * found no difference, with Bayes factors of 0.40 and 0.52 *favouring the null*. A synthesised
 * viewpoint sweep of one identity is that condition by construction. The effect that does work
 * (BF10 in the millions) comes from images captured on *different days*, where hair, light,
 * weight and health have genuinely changed — which is a photograph-collection problem, not a
 * rendering problem. See `docs/09-the-long-room.md`.
 *
 * ── The sampling, and why it is not a Gaussian ──────────────────────────────────────────────
 *
 * Drawing 24 i.i.d. normals around the mean face produces a room of siblings: the mass of a
 * high-dimensional Gaussian sits near the mean, so every head lands close to average and close to
 * every other head. Instead we sample the *direction* uniformly on the unit sphere S²³ and set the
 * *radius* in the 1.2–2.2σ shell. Every head is therefore a 20–60% caricature of a typical face,
 * which is simultaneously the empirically studied caricature range, a free stylisation win, and
 * the thing that makes twenty heads on one screen read as twenty people.
 */

/** The number of independent identity dimensions. Changing this changes every seeded face. */
export const IDENTITY_DIMS = 24

/**
 * Dimension names, in order.
 *
 * Weighted toward *relational* features — the distances between parts — because second-order
 * relational information dominates human face discrimination far more than the shape of any one
 * feature. A face is told apart by where the eyes sit relative to the brow, not by the eye.
 */
export const IDENTITY_KEYS = [
  // Relational (11) — highest discriminative yield.
  'interocular', 'eyeHeight', 'eyeBrowGap', 'eyeDepth', 'nasionToSubnasale', 'philtrum',
  'mouthWidth', 'lipToMenton', 'faceRatio', 'upperLowerBalance', 'hairlineHeight',
  // Global skull form (8).
  'cranialWidth', 'cranialDepth', 'occiput', 'gonialAngle', 'jawWidth', 'zygoWidth',
  'zygoProjection', 'foreheadSlope',
  // Local feature shape (5).
  'noseBridge', 'noseTip', 'nostrilFlare', 'lipFullness', 'chinRound',
] as const

export type IdentityKey = (typeof IDENTITY_KEYS)[number]

/** A point in face space: one signed deviation, in σ, per dimension. */
export type Identity = Record<IdentityKey, number>

/** Box–Muller from two uniforms. Deterministic, because both uniforms are seeded hashes. */
function gaussian(u1: number, u2: number): number {
  const a = Math.max(u1, 1e-9)
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u2)
}

const MIN_SHELL = 1.2
const MAX_SHELL = 2.2

/**
 * A deterministic identity from a seed. Same seed, same face, forever — a person's sculpted
 * stand-in must not change between sessions or it stops being a person.
 */
export function bustIdentity(seed: string): Identity {
  // Direction: a 24-D Gaussian normalised to the unit sphere is the only correct way to draw a
  // uniform direction in high dimensions. Normalising a uniform cube instead concentrates mass in
  // the corners and produces a visible diagonal bias across the population.
  const raw = IDENTITY_KEYS.map((k, i) =>
    gaussian(stableUnitHash(`${seed}:${k}:a`), stableUnitHash(`${seed}:${k}:${i}:b`)),
  )
  const norm = Math.hypot(...raw) || 1
  const radius = MIN_SHELL + stableUnitHash(`${seed}:shell`) * (MAX_SHELL - MIN_SHELL)

  const out = {} as Identity
  IDENTITY_KEYS.forEach((k, i) => {
    out[k] = (raw[i] / norm) * radius * Math.sqrt(IDENTITY_DIMS)
  })
  return out
}

/**
 * A 64-bin radial silhouette profile, in the frontal plane.
 *
 * Distinctiveness has to be verified in *silhouette* space rather than parameter space. Two
 * well-separated parameter vectors can still project to near-identical outlines, and an outline is
 * most of what survives when a head is 60px tall in the background of a room.
 */
export const SILHOUETTE_BINS = 64

export function silhouetteProfile(id: Identity): number[] {
  const bins: number[] = new Array(SILHOUETTE_BINS)
  for (let i = 0; i < SILHOUETTE_BINS; i++) {
    const theta = (i / SILHOUETTE_BINS) * Math.PI * 2
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    // Upper half is cranium, lower half is jaw — they are governed by different dimensions, which
    // is exactly why a profile catches collisions a parameter distance misses.
    const upper = Math.max(0, s)
    const lower = Math.max(0, -s)
    const width = 1 + 0.06 * id.cranialWidth * upper + 0.05 * id.jawWidth * lower + 0.04 * id.zygoWidth
    const height =
      1 + 0.05 * id.faceRatio + 0.04 * id.occiput * upper + 0.05 * id.chinRound * lower
    bins[i] = Math.hypot(c * width, s * height)
  }
  return bins
}

/** L2 distance between two silhouettes. The units are arbitrary; only the ordering matters. */
export function silhouetteDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

/**
 * Mitchell's best-candidate: draw `candidates` identities per slot and keep the one whose nearest
 * neighbour among the already-placed heads is furthest away.
 *
 * This is what stops a crowd from containing two people you cannot tell apart — which in a game
 * about telling people apart is not a cosmetic failure, it is an unfair one.
 */
export function distinctIdentities(seed: string, count: number, candidates = 12): Identity[] {
  const chosen: Identity[] = []
  const profiles: number[][] = []

  for (let i = 0; i < count; i++) {
    let best: Identity | null = null
    let bestProfile: number[] = []
    let bestScore = -Infinity

    for (let c = 0; c < candidates; c++) {
      const id = bustIdentity(`${seed}:${i}:${c}`)
      const profile = silhouetteProfile(id)
      // The first head has no neighbours; any candidate will do, so take the first and move on.
      const score = profiles.length
        ? Math.min(...profiles.map((p) => silhouetteDistance(profile, p)))
        : Infinity
      if (score > bestScore) {
        bestScore = score
        best = id
        bestProfile = profile
      }
      if (score === Infinity) break
    }

    chosen.push(best!)
    profiles.push(bestProfile)
  }
  return chosen
}
