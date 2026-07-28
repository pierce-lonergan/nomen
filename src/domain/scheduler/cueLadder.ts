import type { CueLevel, ScheduleItem } from '../types'

/**
 * The graded cue ladder.
 *
 * Ordered hardest → easiest. Default posture is *errorful retrieval with feedback* (desirable
 * difficulty, Bjork): the attempt is made unaided, and a cue is offered only after a failure.
 * The errorless posture — cue *before* the attempt — is reserved for items that have repeatedly
 * lapsed, matching the finding that errorless learning helps severely impaired memory but is not
 * the better default for a healthy adult.
 */
export const CUE_ORDER: CueLevel[] = [
  'FREE',
  'SEMANTIC_CONTEXT',
  'INITIAL_LETTER',
  'SYLLABLE_PHONEME',
  'FOUR_CHOICE',
  'RESTUDY',
]

export function easeCue(level: CueLevel): CueLevel {
  const i = CUE_ORDER.indexOf(level)
  return CUE_ORDER[Math.min(CUE_ORDER.length - 1, i + 1)]
}

export function hardenCue(level: CueLevel): CueLevel {
  const i = CUE_ORDER.indexOf(level)
  return CUE_ORDER[Math.max(0, i - 1)]
}

/** The cue shown *before* the attempt. `FREE` means none — make the attempt cold. */
export function preAttemptCue(item: ScheduleItem): CueLevel {
  return item.cueFloor
}

export interface CueContent {
  level: CueLevel
  text: string
  choices?: string[]
}

const VOWELS = 'aeiouy'

/** Rough syllable count — good enough for a phonological cue, not a linguistics claim. */
export function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  let count = 0
  let prevVowel = false
  for (const ch of w) {
    const isVowel = VOWELS.includes(ch)
    if (isVowel && !prevVowel) count++
    prevVowel = isVowel
  }
  if (w.endsWith('e') && count > 1) count--
  return Math.max(1, count)
}

/**
 * Build the actual cue shown to the user.
 *
 * `distractors` are supplied by the caller (other names from the same collection) so that the
 * four-choice cue creates real competition rather than a giveaway.
 */
export function buildCue(
  level: CueLevel,
  name: string,
  opts: { context?: string; phonetic?: string; distractors?: string[] } = {},
): CueContent {
  switch (level) {
    case 'FREE':
      return { level, text: '' }
    case 'SEMANTIC_CONTEXT':
      return { level, text: opts.context ? `You met them: ${opts.context}` : 'No context recorded' }
    case 'INITIAL_LETTER':
      return { level, text: `Starts with “${name.charAt(0).toUpperCase()}”` }
    case 'SYLLABLE_PHONEME': {
      const syl = syllableCount(name)
      const sound = opts.phonetic ?? `${name.slice(0, 2)}…`
      return { level, text: `${syl} syllable${syl === 1 ? '' : 's'}, sounds like “${sound}”` }
    }
    case 'FOUR_CHOICE': {
      const pool = (opts.distractors ?? []).filter((d) => d !== name).slice(0, 3)
      return { level, text: 'Which one?', choices: shuffleStable([name, ...pool], name) }
    }
    case 'RESTUDY':
      return { level, text: `The name is ${name}` }
  }
}

/** Deterministic shuffle keyed off the answer, so a card doesn't reshuffle on every render. */
function shuffleStable(items: string[], seed: string): string[] {
  const keyed = items.map((v, i) => ({
    v,
    k: [...`${seed}:${i}:${v}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100003, 7),
  }))
  keyed.sort((a, b) => a.k - b.k)
  return keyed.map((x) => x.v)
}
