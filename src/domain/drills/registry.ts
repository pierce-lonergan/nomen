import type { Phase, RetrievalMode, TrackKind } from '../types'

/**
 * The drill catalogue.
 *
 * Every drill states the mechanism it targets and the evidence behind it, and that text is shown
 * in the app — partly because it is interesting, mostly because a user who understands *why* a
 * drill exists is a user who still does it in month nine.
 *
 * Drills unlock by phase. Unlocks are competence-gated reveals, which is the one form of
 * "reward" the SDT literature is unambiguously positive about: they feed competence rather than
 * substituting a token for it.
 */

export type DrillId =
  | 'FACE_TO_NAME'
  | 'NAME_TO_FACE'
  | 'VOICE_TO_NAME'
  | 'NAME_IN_NOISE'
  | 'DIVIDED_ATTENTION'
  | 'SPEED_RUN'
  | 'INTERFERENCE'
  | 'CAST_RECALL'
  | 'PLACE_RECALL'

export interface DrillDef {
  id: DrillId
  name: string
  mode: RetrievalMode
  track: TrackKind
  minPhase: Phase
  /** One line: what this drill is for. */
  purpose: string
  /** The mechanism and its evidence, shown in-app. */
  mechanism: string
  /** True when the drill deliberately loads attention — logged separately in the metrics. */
  dividedAttention: boolean
  /**
   * Whether the drill can actually run today.
   *
   * This field exists because it was once missing, and the omission produced exactly the failure
   * this app is built to refuse. Five drills were specified, listed on the Program screen with a
   * green "unlocked" pill at the right phase, and never able to produce a single scheduled item —
   * because `capture()` only ever created `MODES_FOR_TRACK[track][0]`. A user reaching Phase 2
   * around month three was told five new drills had opened and got a byte-for-byte identical
   * queue, for the rest of the year.
   *
   * A drill that is specified but not built is now stated as such, in those words. `notBuilt` is
   * the honest reason, shown in the UI.
   */
  notBuilt?: string
}

export const DRILLS: DrillDef[] = [
  {
    id: 'FACE_TO_NAME',
    name: 'Face → Name',
    mode: 'FACE_TO_NAME',
    track: 'PERSON',
    minPhase: 1,
    purpose: 'The core binding: see the person, produce the name.',
    mechanism:
      'Retrieval practice on an arbitrary cross-domain association. Morris et al. (2005) found expanding retrieval gave ~.42 recall against ~.17 for restudy. Images rotate across encounters, because single-image learning does not transfer to real faces (Matthews et al. 2024).',
    dividedAttention: false,
  },
  {
    id: 'NAME_TO_FACE',
    name: 'Name → Face',
    mode: 'NAME_TO_FACE',
    track: 'PERSON',
    minPhase: 2,
    purpose: 'The reverse route: hear the name, bring up the person.',
    mechanism:
      'Exercises the identity node from the lexical side rather than the structural one. Useful preparation for the real situation where you are told who is coming before you see them.',
    dividedAttention: false,
  },
  {
    id: 'VOICE_TO_NAME',
    name: 'Voice → Name',
    mode: 'VOICE_TO_NAME',
    track: 'PERSON',
    minPhase: 2,
    purpose: 'Name someone from their voice alone.',
    mechanism:
      'The left temporal pole is a heteromodal naming hub — it responds near-identically to faces and voices (Waldron et al. 2014; Abel et al. 2015). Training the voice route adds a second way in when the face route stalls.',
    dividedAttention: false,
    notBuilt:
      'Recording is not built yet. The schedule mode and this entry exist; the microphone, the playback and the per-person consent indicator do not, so there is nothing to test you against.',
  },
  {
    id: 'NAME_IN_NOISE',
    name: 'Name in noise',
    mode: 'FACE_TO_NAME',
    track: 'PERSON',
    minPhase: 1,
    purpose: 'Catch a name spoken over background noise.',
    mechanism:
      'The underrated cause of name failure is that the name was never accurately perceived. Low-frequency proper names carry no semantic redundancy, so the brain cannot repair them when they are masked. This trains the input stage, not memory.',
    dividedAttention: false,
    notBuilt:
      'Built as a baseline instrument, not yet as practice. You can be measured on it from the Baseline battery; you cannot yet train on it.',
  },
  {
    id: 'DIVIDED_ATTENTION',
    name: 'Under load',
    mode: 'FACE_TO_NAME',
    track: 'PERSON',
    minPhase: 3,
    purpose: 'Retrieve names while a second task is running.',
    mechanism:
      'Patton (1994) found imagery mnemonics gave no benefit when attempted during real conversation, and Helder & Shaughnessy (2008) found retrieval practice under divided attention barely beat spontaneous rehearsal. If the skill is going to survive a conversation, it has to be trained in one.',
    dividedAttention: true,
  },
  {
    id: 'SPEED_RUN',
    name: 'Speed run',
    mode: 'FACE_TO_NAME',
    track: 'PERSON',
    minPhase: 3,
    purpose: 'Accuracy is assumed; this is about latency.',
    mechanism:
      'Automatization follows a power law of practice (Logan 1988). Full stimulus-driven automaticity is not attainable — every new person is a novel binding — but large speed-ups and reduced felt effort are.',
    dividedAttention: false,
    notBuilt:
      'Not built. Latency is already measured on every retrieval and plotted on Insights, but there is no timed run mode yet.',
  },
  {
    id: 'INTERFERENCE',
    name: 'Interference set',
    mode: 'FACE_TO_NAME',
    track: 'PERSON',
    minPhase: 3,
    purpose: 'Similar-sounding names, deliberately tested together.',
    mechanism:
      'Learning many similar names creates proactive interference, and retrieving some names can suppress competitors. Testing has been shown to protect against proactive interference in face–name learning, so the counter to interference is more retrieval, not less exposure.',
    dividedAttention: false,
    notBuilt:
      'Not built. Clustering phonologically similar names out of your own roster is the missing piece; without it there is no interference set to test.',
  },
  {
    id: 'CAST_RECALL',
    name: 'Cast recall',
    mode: 'CAST_RECALL',
    track: 'CAST',
    minPhase: 2,
    purpose: 'Name the cast of what you are reading or watching, with roles and relationships.',
    mechanism:
      'Character-name tracking is governed by situation-model construction (Zwaan; Rinck & Bower; O’Brien): skilled comprehenders keep the protagonist accessible and actively suppress competitors. Naming roles and relationships — not just names — is what builds the model.',
    dividedAttention: false,
  },
  {
    id: 'PLACE_RECALL',
    name: 'Place names',
    mode: 'PLACE_RECALL',
    track: 'PLACE',
    minPhase: 2,
    purpose: 'Toponyms, anchored to real geography.',
    mechanism:
      'Landmark and place naming runs on the same left-temporal-pole machinery as person naming (Tranel 2006: 73.1 vs 88.0 for controls). This is also the one place the method of loci is genuinely appropriate — the targets are already spatial. Beware using imagined loci for non-spatial material while also learning real geography; the two layouts compete.',
    dividedAttention: false,
  },
]

/** Drills whose phase gate has opened — including any that are specified but not yet built. */
export function drillsAvailable(phase: Phase): DrillDef[] {
  return DRILLS.filter((d) => d.minPhase <= phase)
}

/**
 * Drills that are phase-unlocked AND can actually put work in your queue tonight.
 *
 * This is the list the scheduler reads. `drillsAvailable` is the list the Program screen reads,
 * because a specified-but-unbuilt drill should still be visible and still be honest about itself.
 */
export function drillsLive(phase: Phase): DrillDef[] {
  return DRILLS.filter((d) => d.minPhase <= phase && !d.notBuilt)
}

/**
 * The retrieval modes that should exist for a subject on this track at this phase.
 *
 * The scheduler's single source of truth. `MODES_FOR_TRACK` describes what the *type system*
 * permits; this describes what the app can actually run — and the gap between those two was the
 * bug.
 */
export function modesForPhase(track: TrackKind, phase: Phase): RetrievalMode[] {
  const seen = new Set<RetrievalMode>()
  for (const d of drillsLive(phase)) {
    if (d.track === track) seen.add(d.mode)
  }
  return [...seen]
}

/**
 * The modes a *particular subject* should have scheduled.
 *
 * Phase is necessary but not sufficient: a mode also has to have something to work with. Name →
 * Face shows the name and asks you to bring up the person, then reveals their photograph — so
 * without a photograph the reveal is an empty box, which is worse than not offering the drill.
 * The gate is per-person and per-night rather than global, because a roster is always a mix.
 */
export function modesForSubject(
  track: TrackKind,
  phase: Phase,
  hasImages: boolean,
): RetrievalMode[] {
  return modesForPhase(track, phase).filter((m) => (m === 'NAME_TO_FACE' ? hasImages : true))
}

export function nextUnlock(phase: Phase): DrillDef | null {
  return DRILLS.filter((d) => d.minPhase > phase).sort((a, b) => a.minPhase - b.minPhase)[0] ?? null
}

export function drillById(id: DrillId): DrillDef {
  const d = DRILLS.find((x) => x.id === id)
  if (!d) throw new Error(`Unknown drill: ${id}`)
  return d
}
