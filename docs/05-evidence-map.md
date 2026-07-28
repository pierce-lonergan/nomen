# Evidence map — claim → source → confidence → code

Every mechanism-bearing feature in Nomen traces to a specific claim in the research brief, with an
explicit confidence rating. Features whose evidence is weak are either de-scoped or shipped behind
a caveat that the UI itself states. This table is the contract; if a row's evidence is later
overturned, the linked code is what changes.

**Confidence key** — `HIGH`: replicated, meta-analytic, or lesion/imaging-converging ·
`MODERATE`: solid primary studies, limited replication or ecological validity ·
`LOW`: small-N, clinical-only, or contested · `CONTESTED`: the literature actively disagrees.

| # | Claim | Source (per brief) | Conf. | Implemented in |
| --- | --- | --- | --- | --- |
| 1 | Retrieval practice beats restudy for names (.42 vs .17; 300–400% with meaning/imagery) | Morris, Fritz, Jackson, Nichol & Roberts 2005 | HIGH | `scheduler/schedule.ts`; "test before you peek" UI rule |
| 2 | Expanding retrieval gains hold at 30 min, 2 wks, 11 months in an ecological setting | Morris & Fritz 2000, 2002, 2004 (name game) | HIGH | ladder in `scheduler/schedule.ts` |
| 3 | Expanding **vs uniform** superiority is unresolved (g ≈ 0.03) | Latimier et al. 2020; Karpicke & Roediger 2007; Toppino et al. 2018 | CONTESTED | `scheduleMode: 'expanding' \| 'uniform'` user setting, documented in-app |
| 4 | Expanding wins when initial learning is weak → front-load the first retrieval | Toppino, Phelan & Gerbier 2018 | MODERATE | 20s first rung; `FRONT_LOAD_RUNGS` |
| 5 | Names are semantically impoverished terminal nodes (Baker/baker) | McWeeny et al. 1987; Cohen 1990; Brédart 2017 | HIGH | HOOK beat; elaboration layer |
| 6 | Name retrieval is a distinct stage after identity resolution | Bruce & Young 1986; Burton et al. 1990 IAC | HIGH | separate `FACE_TO_NAME` / `NAME_TO_FACE` items; TOT grade `CUED` |
| 7 | Left temporal pole is the lexical hub for unique entities; heteromodal | Damasio 1996/2004; Tranel 2006; Waldron 2014; Abel 2015 | HIGH | `VOICE_TO_NAME` drill; place-name track |
| 8 | Face–name binding is hippocampal cross-domain binding | Sperling 2001; Zeineh 2003 | HIGH | rationale for retrieval-not-restudy + sleep slot |
| 9 | Transmission deficit: infrequent/non-recent use weakens phonological transmission | MacKay & Burke; Rastle & Burke 1996 | HIGH | permanent maintenance queue; no "mastered" state |
| 10 | Production effect — saying aloud aids memory | MacLeod et al. 2010; Fawcett 2013 meta-analysis | HIGH | SAY beat; "use a name aloud" missions |
| 11 | Depth of processing / semantic elaboration ≈ doubles recall | Craik & Lockhart 1972; Morris et al. 2005 | HIGH | HOOK beat |
| 12 | Self-focused attention degrades encoding at introductions | Clark & Wells 1995; Spurr & Stopa 2002; Boehme 2015 | MODERATE | LOOK beat (attention outward); adherence tracking |
| 13 | Names in noise are often never perceived — an input, not memory, failure | cocktail-party / glimpsing-and-masking | MODERATE | name-in-noise drill + screen; `PERCEPTUAL_INPUT` verdict |
| 14 | Single-image face learning does not transfer to real faces | Matthews et al. 2024; Burton | HIGH | `confidenceCeiling()` gate; no-repeat-image rule |
| 15 | Imagery mnemonics fail under conversational load | Patton 1994; Brédart 2019 | MODERATE | imagery is offline-only; live protocol has no imagery step |
| 16 | Keyword-image method works in lab conditions (d ≈ 2.44) | Morris, Jones & Hampson 1978; McCarty 1980 | HIGH (lab) | offline imagery workshop for high-value people only |
| 17 | Bizarreness effect is narrower than marketed | McDaniel & Geraci; Worthen; Schmidt | MODERATE | UI asks for "distinctive", never "bizarre" |
| 18 | Working-memory / brain training does not far-transfer | Melby-Lervåg, Redick & Hulme 2016; Simons et al. 2016 | HIGH | no generic brain games exist in the app |
| 19 | Method of loci trains a real but domain-specific skill | Dresler et al. 2017 | HIGH (narrow) | offered **only** in the place-name track |
| 20 | Automatization follows a power law; full automaticity unattainable for novel people | Logan 1988/1992; ACT-R; Heathcote 2000 | MODERATE | `fitPowerLaw()`; "fast and fluent, not effortless" copy |
| 21 | Errorless learning helps the severely impaired; errorful+feedback is better for healthy adults | Baddeley & Wilson 1994; desirable difficulties (Bjork) | MODERATE | errorful default; errorless only after ≥ 3 lapses |
| 22 | Sleep (NREM/SWS) consolidates paired associates | consolidation literature | HIGH | pre-sleep review slot; sleep logging |
| 23 | Targeted memory reactivation strengthens paired associates | TMR literature, some nulls | LOW | **not implemented** — impractical to self-administer |
| 24 | Spaced-retrieval training transfers to real life in clinical samples (~50–85%) | Hopper 2010; Mahendra 2011; Hawley & Cherry 2004 | LOW (clinical, small-N) | field missions; transfer measured, not assumed |
| 25 | Digital face-name tool efficacy in healthy adults | essentially unstudied | LOW | app states this in onboarding; H1–H5 self-experiments |
| 26 | Retrieval protects against proactive interference in face-name learning | testing-effect literature | MODERATE | interference sets (Phase 3) |
| 27 | Situation-model construction governs narrative name tracking | Zwaan; Rinck & Bower; O'Brien | MODERATE | cast track: roles + relationships, not just names |

## Deliberate omissions

| Not built | Why |
| --- | --- |
| TMR / audio cueing during sleep | #23 — unreliable and not self-administrable |
| Generic memory games, "brain age" score | #18 — no far transfer |
| Live imagery coaching | #15 — collapses under divided attention |
| Single-photo import decks | #14 — trains photo recognition, not face recognition |
| A global "memory score" | no validated construct; invites the self-deception the brief warns about |

## Honesty rails in the UI

- Every statistic displays its `n`; below `n = 10` no trend is drawn.
- Assessment items are held out from training items, so the measurement is not contaminated.
- Onboarding states the achievable and unachievable outcomes verbatim from the brief's caveats.
