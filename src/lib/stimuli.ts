import { stableUnitHash } from '../domain/time'

/**
 * Assessment stimuli.
 *
 * These are procedurally generated rather than photographic, for two reasons: the app ships no
 * third-party face images, and assessment items must be *held out* from training items so the
 * measurement is not contaminated by the thing it is measuring.
 *
 * The honest caveat, stated in the app: synthetic faces are a weaker proxy for real face
 * individuation than photographs of real people. The battery is a **routing instrument** — it tells
 * you which stage to train first — not a clinical assessment. Anything stronger would need
 * validated photographic stimulus sets that cannot be bundled here.
 */

export const ASSESSMENT_NAMES = [
  'Marek', 'Priya', 'Idris', 'Elena', 'Tomas', 'Naledi', 'Yusuf', 'Beatriz',
  'Hana', 'Callum', 'Sofia', 'Dmitri', 'Amara', 'Sven', 'Leila', 'Owen',
  'Ines', 'Kwame', 'Rosa', 'Anders', 'Mei', 'Farouk', 'Greta', 'Nikhil',
]

export interface FaceParams {
  hue: number
  jaw: number
  eyeGap: number
  eyeSize: number
  browAngle: number
  noseLength: number
  mouthWidth: number
  hairline: number
}

/** Deterministic face parameters from a seed — same seed, same face, forever. */
export function faceParams(seed: string): FaceParams {
  const h = (salt: string) => stableUnitHash(`${seed}:${salt}`)
  return {
    hue: 20 + h('hue') * 40,
    jaw: 0.72 + h('jaw') * 0.28,
    eyeGap: 0.28 + h('gap') * 0.16,
    eyeSize: 0.05 + h('eye') * 0.045,
    browAngle: -12 + h('brow') * 24,
    noseLength: 0.1 + h('nose') * 0.09,
    mouthWidth: 0.16 + h('mouth') * 0.14,
    hairline: 0.18 + h('hair') * 0.14,
  }
}

/**
 * A variant of the same face — a different "image" of the same identity.
 *
 * Used by the individuation test so that matching cannot be solved by pixel comparison, which is
 * the whole point: within-person variability is what makes face learning hard and what makes
 * single-image learning fail to transfer.
 */
export function faceVariant(base: FaceParams, variant: number): FaceParams {
  const jitter = (v: number, amount: number) => v + Math.sin(variant * 2.3 + v * 10) * amount
  return {
    ...base,
    hue: jitter(base.hue, 6),
    jaw: jitter(base.jaw, 0.05),
    eyeGap: jitter(base.eyeGap, 0.015),
    eyeSize: jitter(base.eyeSize, 0.006),
    browAngle: jitter(base.browAngle, 5),
    noseLength: jitter(base.noseLength, 0.012),
    mouthWidth: jitter(base.mouthWidth, 0.02),
    hairline: jitter(base.hairline, 0.02),
  }
}

/** Deterministic pick of `count` distinct items, seeded so a test session is reproducible. */
export function pick<T>(pool: T[], count: number, seed: string): T[] {
  return [...pool]
    .map((v, i) => ({ v, k: stableUnitHash(`${seed}:${i}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count)
    .map((x) => x.v)
}
