import type { Attempt, DayRecord, Grade, MediaRef, Moment, Person, ScheduleItem } from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'
import { DAY, dayKey, HOUR, MINUTE } from '../domain/time'
import { applyGrade, createItem } from '../domain/scheduler/schedule'
import { putAll, saveSettings } from './db'

/**
 * Demo history generator.
 *
 * Produces a simulated eight months of practice so that Insights, Program, and the gates have real
 * data to work against — including the parts that are unflattering. The simulated user is
 * deliberately ordinary: better in quiet rooms than loud ones, worse when tired, and improving on a
 * power-law curve that is already flattening.
 *
 * Fully deterministic: same seed, same history, which makes it useful for eyeballing UI states and
 * for reproducing bugs.
 */

const NAMES = [
  ['Sarah', 'Whitfield'], ['Marcus', 'Oyelaran'], ['Priya', 'Raghunathan'], ['Tom', 'Beckett'],
  ['Lena', 'Hoffmann'], ['Idris', 'Bakare'], ['Claire', 'Dunn'], ['Hiroshi', 'Tanabe'],
  ['Nadia', 'Kaplan'], ['Ben', 'Aldridge'], ['Rosa', 'Iglesias'], ['Kwame', 'Mensah'],
  ['Ellie', 'Prentice'], ['Anders', 'Lund'], ['Fatima', 'Zahra'], ['Joe', 'Kirkby'],
  ['Mei', 'Chen'], ['Callum', 'Reid'], ['Ines', 'Moreau'], ['Dmitri', 'Volkov'],
  ['Grace', 'Okonkwo'], ['Sven', 'Eriksson'], ['Leila', 'Nassar'], ['Owen', 'Pritchard'],
  ['Beatriz', 'Santos'], ['Yusuf', 'Demir'], ['Hana', 'Novak'], ['Robert', 'Ashcombe'],
]

const SETTINGS_POOL = [
  { label: 'the office', noise: 'QUIET' as const, likelihood: 'HIGH' as const },
  { label: 'a conference', noise: 'MODERATE' as const, likelihood: 'LOW' as const },
  { label: 'Ana’s birthday', noise: 'LOUD' as const, likelihood: 'MEDIUM' as const },
  { label: 'the climbing gym', noise: 'MODERATE' as const, likelihood: 'HIGH' as const },
  { label: 'a wedding', noise: 'LOUD' as const, likelihood: 'LOW' as const },
  { label: 'the school gate', noise: 'QUIET' as const, likelihood: 'HIGH' as const },
]

/** Deterministic pseudo-random generator — seeded so the demo history is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export async function seedDemoData(now: number): Promise<void> {
  const random = rng(20260728)
  const startedAt = now - 240 * DAY

  const people: Person[] = []
  const media: MediaRef[] = []
  const items: ScheduleItem[] = []
  const attempts: Attempt[] = []
  const days = new Map<string, DayRecord>()
  const moments: Moment[] = []

  const settings = { ...DEFAULT_SETTINGS, phase: 3 as const, phaseEnteredAt: now - 40 * DAY }

  NAMES.forEach(([given, family], i) => {
    const metAt = startedAt + Math.floor((i / NAMES.length) * 220 * DAY) + Math.floor(random() * 6 * HOUR)
    const place = SETTINGS_POOL[i % SETTINGS_POOL.length]
    // Protocol adherence improves over the simulated year — that is the Phase 1 story.
    const progress = i / NAMES.length
    const adherent = random() < 0.45 + progress * 0.5
    const encounterId = `demo-enc-${i}`

    const person: Person = {
      id: `demo-person-${i}`,
      track: 'PERSON',
      displayName: `${given} ${family}`,
      givenName: given,
      familyName: family,
      phonetic: i % 5 === 0 ? `${given.toUpperCase()}` : undefined,
      hook: i % 3 === 0 ? 'architect, sails at weekends' : i % 3 === 1 ? 'runs the Tuesday standup' : undefined,
      context: place.label,
      metAt,
      likelihoodOfMeetingAgain: place.likelihood,
      status: 'ACTIVE',
      highValue: place.likelihood === 'HIGH',
      encounters: [
        {
          id: encounterId,
          at: metAt,
          context: {
            noise: place.noise,
            alcohol: place.noise === 'LOUD' && random() < 0.7,
            fatigue: 1 + Math.floor(random() * 4),
            stress: place.noise === 'LOUD' ? 3 + Math.floor(random() * 2) : 1 + Math.floor(random() * 2),
            setting: place.label,
          },
          adherence: {
            heard: adherent || random() < 0.7,
            said: adherent,
            looked: adherent || random() < 0.5,
            hooked: adherent && random() < 0.8,
          },
          mediaIds: [],
        },
      ],
      imageMediaIds: [],
      voiceMediaIds: [],
    }

    // Some people get a second encounter, which is what actually moves the face-confidence ceiling.
    if (random() < 0.45) {
      const secondAt = metAt + Math.floor((5 + random() * 40) * DAY)
      if (secondAt < now) {
        person.encounters.push({
          id: `${encounterId}-b`,
          at: secondAt,
          context: { noise: 'QUIET', alcohol: false, fatigue: 2, stress: 2, setting: place.label },
          adherence: { heard: true, said: true, looked: true, hooked: true },
          mediaIds: [],
        })
      }
    }

    people.push(person)

    // Simulate the retrieval history for this person.
    let item = createItem(`demo-item-${i}`, person.id, 'PERSON', 'FACE_TO_NAME', metAt, settings)
    let cursor = item.due
    let attemptIndex = 0

    while (cursor < now && attemptIndex < 40) {
      const ctx = person.encounters[0].context
      // Base success rises with practice; noise, fatigue, and alcohol at encoding all cost.
      let p = 0.55 + progress * 0.25
      if (ctx.noise === 'LOUD') p -= 0.28
      else if (ctx.noise === 'MODERATE') p -= 0.08
      if (ctx.alcohol) p -= 0.12
      if (ctx.fatigue >= 4) p -= 0.1
      if (person.encounters[0].adherence.said) p += 0.14
      p += Math.min(0.15, attemptIndex * 0.02)

      const roll = random()
      const grade: Grade = roll > p ? (roll > p + 0.15 ? 'MISS' : 'CUED') : random() < 0.35 ? 'INSTANT' : 'GOT'

      // Latency falls on a power-law-ish curve, with a floor it never goes below.
      const totalAttempts = attempts.length + 1
      const latency = Math.round(900 + 4200 * Math.pow(totalAttempts, -0.35) + random() * 700)

      const outcome = applyGrade(item, grade, cursor, settings)
      attempts.push({
        id: `demo-attempt-${i}-${attemptIndex}`,
        itemId: item.id,
        subjectId: person.id,
        mode: 'FACE_TO_NAME',
        at: cursor,
        grade,
        latencyMs: grade === 'INSTANT' ? Math.min(latency, 1400) : latency,
        cueUsed: grade === 'CUED' ? 'INITIAL_LETTER' : 'FREE',
        delaySinceEncodingMs: cursor - person.metAt,
        dividedAttention: cursor > now - 40 * DAY && random() < 0.3,
        wasRescue: outcome.wasRescue,
      })

      const key = dayKey(cursor)
      const record = days.get(key) ?? {
        day: key,
        retrievalsDue: 0,
        retrievalsDone: 0,
        newPeople: 0,
        namesUsedAloud: 0,
        missionCompleted: false,
        restDay: false,
        freezeUsed: false,
        preSleepReviewDone: random() < 0.7,
      }
      record.retrievalsDone += 1
      record.retrievalsDue += 1
      if (random() < 0.25) record.namesUsedAloud += 1
      days.set(key, record)

      item = outcome.item
      cursor = item.due + Math.floor(random() * 6 * HOUR)
      attemptIndex++
    }

    // Leave the schedule in a plausible present-day state rather than all due at once.
    items.push({ ...item, due: now + Math.floor(random() * 5 * DAY) - 2 * DAY })

    const metDay = dayKey(metAt)
    const metRecord = days.get(metDay) ?? {
      day: metDay,
      retrievalsDue: 0,
      retrievalsDone: 0,
      newPeople: 0,
      namesUsedAloud: 0,
      missionCompleted: false,
      restDay: false,
      freezeUsed: false,
      preSleepReviewDone: true,
    }
    metRecord.newPeople += 1
    days.set(metDay, metRecord)
  })

  moments.push(
    {
      id: 'demo-moment-1',
      at: now - 52 * DAY,
      subjectId: 'demo-person-3',
      text: 'Ran into Tom at the coffee place five weeks after meeting him once. Got it before he said anything. He looked genuinely pleased.',
      feeling: 'GREAT',
    },
    {
      id: 'demo-moment-2',
      at: now - 21 * DAY,
      subjectId: 'demo-person-10',
      text: 'Introduced Rosa to two colleagues by name without a pause. A year ago I would have said "this is... sorry".',
      feeling: 'GOOD',
    },
    {
      id: 'demo-moment-3',
      at: now - 4 * DAY,
      text: 'Loud bar, three new people, got all three the next morning. The asking-for-a-repeat thing is what did it.',
      feeling: 'RELIEF',
    },
  )

  // A couple of recent rest days and a gap, so the streak logic has something real to handle.
  const yesterday = dayKey(now - DAY)
  const restRecord = days.get(yesterday)
  if (restRecord) days.set(yesterday, { ...restRecord, restDay: true })

  await putAll('people', people)
  await putAll('media', media)
  await putAll('items', items)
  await putAll('attempts', attempts)
  await putAll('days', [...days.values()])
  await putAll('moments', moments)
  await saveSettings(settings)
}

/** Exported for tests: the shape of the simulated user, so the generator itself can be checked. */
export const DEMO_PERSON_COUNT = NAMES.length
export const DEMO_SPAN_DAYS = 240
export const DEMO_MINUTE = MINUTE
