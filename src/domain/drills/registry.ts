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

export function drillsAvailable(phase: Phase): DrillDef[] {
  return DRILLS.filter((d) => d.minPhase <= phase)
}

export function nextUnlock(phase: Phase): DrillDef | null {
  return DRILLS.filter((d) => d.minPhase > phase).sort((a, b) => a.minPhase - b.minPhase)[0] ?? null
}

export function drillById(id: DrillId): DrillDef {
  const d = DRILLS.find((x) => x.id === id)
  if (!d) throw new Error(`Unknown drill: ${id}`)
  return d
}
