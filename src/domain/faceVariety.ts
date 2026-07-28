import type { MediaRef, Person } from './types'

/**
 * Image-variety enforcement.
 *
 * Well-powered face-perception work (Matthews, Ritchie, Laurence & Mondloch 2024; Burton's
 * within-person-variability programme) finds that learning a face from a single static image does
 * not generalise to recognising that person from a different image or in life — and specifically
 * that *"multiple images captured from a single encounter do not promote face learning"*.
 *
 * So the gate counts **distinct encounters**, not raw photos. A burst of ten shots at one party
 * is still one encounter and still does not buy you a face.
 */

export type FaceConfidence = 'PHOTO_ONLY' | 'FAMILIAR' | 'ROBUST'

export const FACE_CONFIDENCE_COPY: Record<FaceConfidence, string> = {
  PHOTO_ONLY: 'You know a picture, not a face — add a look from another day.',
  FAMILIAR: 'Seen across more than one occasion. Real face learning has started.',
  // States the measurement, not a prediction. The evidence supports that within-person variability
  // is necessary for face learning; it does not support a robustness guarantee off three
  // photographs — and this app has no "learned" state to assert in the first place.
  ROBUST: 'Learned across three separate occasions — the variety that actually transfers. Keep adding looks; nothing here is permanent.',
}

export function distinctImageEncounters(person: Person, media: MediaRef[]): number {
  const images = media.filter((m) => m.personId === person.id && m.kind === 'IMAGE')
  return new Set(images.map((m) => m.encounterId)).size
}

/** A hard cap on how confident the app will let you feel, given the evidence available. */
export function confidenceCeiling(person: Person, media: MediaRef[]): FaceConfidence {
  const images = media.filter((m) => m.personId === person.id && m.kind === 'IMAGE')
  const encounters = distinctImageEncounters(person, media)
  if (images.length >= 3 && encounters >= 3) return 'ROBUST'
  if (images.length >= 2 && encounters >= 2) return 'FAMILIAR'
  return 'PHOTO_ONLY'
}

/**
 * Choose the image to show for a drill, never repeating the previously shown one.
 *
 * Rotation is by encounter first, so the user sees this person on different days rather than
 * three frames from the same three seconds.
 */
export function nextDrillImage(
  person: Person,
  media: MediaRef[],
  lastShownId: string | null,
): MediaRef | null {
  const images = media
    .filter((m) => m.personId === person.id && m.kind === 'IMAGE')
    .sort((a, b) => a.capturedAt - b.capturedAt)
  if (images.length === 0) return null
  if (images.length === 1) return images[0]

  const lastIdx = images.findIndex((m) => m.id === lastShownId)
  if (lastIdx === -1) return images[0]

  const lastEncounter = images[lastIdx].encounterId
  const fromOtherEncounter = images.find((m) => m.encounterId !== lastEncounter)
  return fromOtherEncounter ?? images[(lastIdx + 1) % images.length]
}

/** People whose face record is too thin to train against — the "needs more looks" list. */
export function needsMoreLooks(people: Person[], media: MediaRef[]): Person[] {
  return people
    .filter((p) => p.track === 'PERSON' && p.status === 'ACTIVE')
    .filter((p) => confidenceCeiling(p, media) === 'PHOTO_ONLY')
}

/** Share of active people who have cleared the single-image trap. A Phase 2 gate criterion. */
export function varietyCoverage(people: Person[], media: MediaRef[]): { covered: number; total: number; ratio: number } {
  const active = people.filter((p) => p.track === 'PERSON' && p.status === 'ACTIVE')
  const covered = active.filter((p) => confidenceCeiling(p, media) !== 'PHOTO_ONLY').length
  return { covered, total: active.length, ratio: active.length === 0 ? 0 : covered / active.length }
}
