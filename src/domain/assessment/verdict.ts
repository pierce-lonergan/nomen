import type { AssessmentResult, BaselineVerdict } from '../types'

/**
 * Phase-0 routing.
 *
 * The brief's §9 is emphatic that several *non-memory* factors produce name failure, and that
 * they should be ruled out before the problem is attributed to memory at all. This function is
 * that rule-out, expressed as code so it cannot quietly drift from the documentation.
 *
 * It is deliberately non-diagnostic: it routes training, and where a medical check is the
 * sensible next step it says so in plain language without pretending to be a clinician.
 */

export interface VerdictOutput {
  verdict: BaselineVerdict
  headline: string
  reasoning: string
  /** What Phase 1 should weight, given this route. */
  emphasis: string[]
  /** Non-diagnostic flags worth acting on outside the app. */
  flags: string[]
}

const THRESHOLDS = {
  /** Below this on the in-noise screen, the bottleneck is plausibly perception, not memory. */
  noiseFloor: 0.6,
  /** Below this on face individuation, faces are not being encoded distinctly enough to bind to. */
  faceFloor: 0.65,
  /** At or above this on face–name recall, accuracy is not the complaint. */
  recallCeiling: 0.7,
}

function scoreOf(results: AssessmentResult[], kind: AssessmentResult['kind']): number | null {
  const latest = results
    .filter((r) => r.kind === kind)
    .sort((a, b) => b.at - a.at)[0]
  return latest ? latest.score : null
}

export function computeVerdict(results: AssessmentResult[]): VerdictOutput {
  const faceName = scoreOf(results, 'FACE_NAME')
  const individuation = scoreOf(results, 'FACE_INDIVIDUATION')
  const noise = scoreOf(results, 'NAME_IN_NOISE')
  const confoundRisk = scoreOf(results, 'CONFOUND_SCREEN')

  const flags: string[] = []
  if (confoundRisk !== null && confoundRisk >= 0.5) {
    flags.push(
      'Your screener flagged sleep, stress, or alcohol as a recurring factor. These affect encoding and consolidation directly — worth addressing alongside the training rather than after it.',
    )
  }

  // Perceptual input comes first: if the name never arrived, nothing downstream is the problem.
  if (noise !== null && noise < THRESHOLDS.noiseFloor) {
    flags.push(
      'If names fail mostly in bars, parties, and busy streets, that pattern points at hearing rather than memory. A hearing check is a reasonable, low-cost thing to rule out.',
    )
    return {
      verdict: 'PERCEPTUAL_INPUT',
      headline: 'Your bottleneck looks like hearing the name, not remembering it',
      reasoning:
        'You scored below the working threshold on names spoken over background noise. Proper names are low-frequency and carry no semantic redundancy, so when they are masked your brain has nothing to repair them with — the name is often never accurately perceived in the first place. That is an input problem, and no amount of memory training fixes it.',
      emphasis: [
        'Name-in-noise drills before anything else',
        'Ask for a repeat or a spelling every single time — this is the mechanically justified move, not just politeness',
        'Move the introduction: step away from the speaker, turn to face them',
      ],
      flags,
    }
  }

  if (individuation !== null && individuation < THRESHOLDS.faceFloor) {
    return {
      verdict: 'FACE_INDIVIDUATION',
      headline: 'Faces are the weak side of the binding',
      reasoning:
        'You are below threshold on telling unfamiliar faces apart. You cannot bind a name to a face you did not encode distinctly, so face work has to come before name work for you. Face-processing ability is a wide, substantially heritable spectrum — this is a starting point, not a verdict on you.',
      emphasis: [
        'Face-variety work first: multiple looks across different days',
        'Study faces in motion where you can, not from single photographs',
        'Name drills weighted toward Name → Face until individuation improves',
      ],
      flags,
    }
  }

  if (faceName !== null && faceName >= THRESHOLDS.recallCeiling) {
    return {
      verdict: 'RETRIEVAL_FLUENCY',
      headline: 'Accuracy is fine — speed is your complaint',
      reasoning:
        'You recall names at a rate that is not obviously the problem. That points at fluency: the retrieval happens, but slowly and effortfully, which in a live conversation is indistinguishable from failing. This is the normal power-law tail, and it responds to volume.',
      emphasis: [
        'Skip ahead: start at the retrieval engine rather than the encoding habit',
        'Speed runs and divided-attention drills earlier than usual',
        'Track latency, not just accuracy',
      ],
      flags,
    }
  }

  return {
    verdict: 'ENCODING_ATTENTION',
    headline: 'Your bottleneck is attention at the moment of introduction',
    reasoning:
      'This is the common case, and it is good news: the one-minute failure is almost always an encoding failure, not a storage defect. At the moment the name is spoken your attention is on what to say next rather than on the name, so there is nothing to retrieve a minute later. Fixing attention at introduction is the largest and cheapest intervention available.',
    emphasis: [
      'The four-beat protocol on every single introduction — hear, say, look, hook',
      'The 20-second check immediately after: the first retrieval must succeed',
      'Low-stakes settings first (shops, cafés), then colleagues, then parties',
    ],
    flags,
  }
}

export const BASELINE_INSTRUMENTS: { kind: AssessmentResult['kind']; label: string; blurb: string }[] = [
  {
    kind: 'FACE_NAME',
    label: 'Face–name learning',
    blurb: 'Learn a set of face–name pairs, then recall them after a delay. Your primary outcome anchor.',
  },
  {
    kind: 'FACE_INDIVIDUATION',
    label: 'Telling faces apart',
    blurb: 'Match unfamiliar faces across different images. Checks whether faces are the weak side.',
  },
  {
    kind: 'NAME_IN_NOISE',
    label: 'Names in noise',
    blurb: 'Report names spoken over background babble. Separates hearing from remembering.',
  },
  {
    kind: 'CONFOUND_SCREEN',
    label: 'Context screener',
    blurb: 'Sleep, stress, alcohol, attention, hearing. Ruled out neutrally, not diagnosed.',
  },
]
