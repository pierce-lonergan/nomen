# Nomen — Product Specification

> **One-line thesis.** Nomen is a local-first trainer that fixes *encoding first*, runs a
> *spaced-retrieval engine* second, and treats everything glamorous (imagery mnemonics, memory
> palaces, brain-training) as optional, offline, or out of scope — because that is what the
> evidence supports.

---

## 1. Problem statement (from the research brief)

The failure mode being trained is **"I was told the name one minute ago and it is gone."** The
brief establishes that this is overwhelmingly an **encoding failure**, not a storage-capacity
defect: at the moment of introduction, attention is on self-presentation rather than on the name,
and in noisy settings the name is often *never accurately perceived* in the first place.

Three architectural facts constrain any honest design:

| Fact | Source in brief | Design consequence |
| --- | --- | --- |
| Names are terminal, semantically-impoverished nodes reached only after identity resolves | Bruce & Young 1986; Burton, Bruce & Johnston 1990 IAC | "I know everything but the name" is the *predicted default*. Never shame the user for it. |
| The face↔name link is arbitrary cross-domain binding, hippocampus-dependent and fragile | Sperling 2001; Zeineh 2003 | Binding needs *retrieval*, not re-exposure, and needs *sleep*. |
| Connections decay without recent, frequent use (transmission deficit) | MacKay & Burke; Rastle & Burke 1996 | Permanence is impossible. Maintenance is a permanent feature, not a failure. |

## 2. Non-goals (explicitly de-scoped, with reasons)

Stating these up front is a product feature: the brief's own "Caveats" section warns that the
glamorous parts of the popular canon are the unsupported ones.

- **No general "brain training."** No n-back, no dual-task IQ games, no "memory score." Far
  transfer does not exist (Melby-Lervåg, Redick & Hulme 2016: 145 comparisons, no reliable far
  transfer vs. treated controls). Nomen trains names and adjacent, specific targets only.
- **No live imagery mnemonics.** Patton (1994) found the keyword-image method gave *no* benefit
  when attempted during real conversation. Nomen deliberately keeps the live protocol to
  hear → say → hook, and confines heavy imagery to the **offline** review of a small number of
  high-value people.
- **No single-photo flashcard decks as the default.** Matthews et al. (2024) and Burton's
  within-person-variability program show single-image learning does not transfer to real faces.
  The app *actively blocks* a person from reaching high-confidence status on one photo.
- **No promise of permanence.** The UI never says "learned forever." It says
  "retained through <interval>, next check <date>."
- **No cloud, no account, no social graph, no ads.** See `06-privacy.md`.

## 3. The six training modalities and the mechanism each targets

Each maps 1:1 onto the "Training modalities" section of the brief.

### 3.1 Encoding drills — the Capture micro-protocol
**Targets:** attention at encoding, self-focused attention (Clark & Wells 1995; Spurr & Stopa
2002), production effect (MacLeod 2010; Fawcett 2013), acoustic verification (cocktail-party
problem).

A fixed four-beat protocol, the same every time, drilled to automaticity:

1. **HEAR** — did the name arrive clearly? If not → *ask now* (repeat / spell / origin).
2. **SAY** — say it back aloud in a sentence ("Good to meet you, Sarah"). Production effect.
3. **LOOK** — look at the face while saying it. Forces the binding to be face-anchored, and
   redirects attention outward, which is the SFA countermeasure.
4. **HOOK** — one lightweight semantic association. One. Not an image palace.

The app logs **adherence per beat**, because adherence is the process metric that predicts the
outcome metric. Immediately after, it schedules a **~20-second front-loaded retrieval** — the
first retrieval must succeed (Toppino, Phelan & Gerbier 2018: expanding wins precisely when
initial learning is weak, and its benefit depends on early success).

### 3.2 Spaced retrieval engine
**Targets:** transmission-deficit reversal, consolidation, the testing effect.
Morris et al. (2005): expanding retrieval ≈ .42 recall vs ≈ .17 restudy; 300–400% with a
meaning/imagery layer. This is the load-bearing mechanism of the whole product.

See `04-architecture.md` §2 for the algorithm. Key commitments:
- Early-then-expanding ladder: **20s → 2m → 10m → 1h → tonight (pre-sleep) → 1d → 3d → 1w → 3w → 2m → 6m**.
- `expanding | uniform` is a **user-visible setting**, because the literature is genuinely
  unresolved (Latimier et al. 2020: g ≈ 0.03 overall). We ship expanding-by-default and say why.
- **Test before you peek** is enforced by the UI: the answer is never on screen with the prompt.

### 3.3 Elaboration layer
**Targets:** depth of processing (Craik & Lockhart 1972), the Baker/baker paradox — converting a
dead-end label into a connected one.
Live: one hook, ≤ 5 words. Offline: an optional keyword/imagery workshop for people flagged
high-value. Bizarreness is *not* pushed — the brief flags it as a narrower and less reliable
effect than mnemonics marketing implies; the app asks for **distinctive**, not "weird."

### 3.4 Face individuation
**Targets:** the face side of the binding; the transfer problem.
- A person's **image variety score** is first-class. One photo = capped confidence, and a visible
  "needs more looks" state.
- Drills never show the same image twice in a row for the same person.
- Optional face-individuation screening in Phase 0 tells the user whether their bottleneck is
  actually face processing rather than naming.

### 3.5 Third-party name track (cast tracking)
**Targets:** situation-model construction and referent suppression (Zwaan; Rinck & Bower;
O'Brien) for names in books and film.
Mechanic: at chapter/episode boundaries, the app prompts a **cast recall** — name everyone, then
their role and relationship. Same retrieval engine, different item type.

### 3.6 Place-name track
**Targets:** the same left-temporal-pole naming machinery (Tranel 2006: landmark naming 73.1 vs
88.0 controls). Spatially anchored, and the one place the method of loci is *not* discouraged —
with an explicit warning about imagined/real spatial interference.

## 4. Drill catalogue

| Drill | Trains | Evidence hook |
| --- | --- | --- |
| Face → Name (varied image) | core binding retrieval | Morris 2005; Matthews 2024 |
| Name → Face | reverse-direction retrieval, PIN access | Bruce & Young flow |
| Voice → Name | heteromodal naming hub | Waldron 2014; Abel 2015 |
| Name-in-noise | acoustic encoding under masking | cocktail-party / glimpsing |
| Divided attention | transfer to real conversation | Patton 1994; Helder & Shaughnessy 2008 |
| Speed run | fluency / power-law automatization | Logan 1988; ACT-R |
| Interference set | proactive interference resistance | RIF; Phase 3 of the brief |
| Cast recall | referent tracking | situation-model literature |
| Place recall | toponym retrieval | Tranel 2006 |

## 5. Assessment strategy

Deliberately separated from training items so the user cannot fool themselves — the brief's
"controls for self-deception."

- **Phase 0 battery:** face–name paired-associate test (FNAME-shaped, held-out items),
  face-individuation screen, digits/name-in-noise screen, and a confound questionnaire
  (sleep, stress, alcohol, hearing, attention regulation).
- **Monthly re-test** with parallel forms; the dashboard reports *measured* change, never a vibe.
- **Decision thresholds** are implemented as code, not prose (`domain/assessment/verdict.ts`):
  - failures concentrated in noisy contexts → routes the user to encoding/hearing, not memory;
  - weak face individuation → weights Phase 1 toward face work;
  - accuracy fine but latency high → "you are in the normal power-law tail; keep accumulating."

## 6. Primary and process metrics

- **Primary:** proportion recalled at fixed delays — post-conversation, next day, 1 week, 1 month.
- **Process:** protocol adherence rate; retrieval latency (power-law fit); TOT frequency;
  image-variety coverage; names used aloud in the field.
- **Honesty rail:** every number shows its `n`. Below `n = 10` the app shows the count and
  refuses to draw a trend line.

## 7. Failure modes with shipped countermeasures

| Failure mode (from brief) | Countermeasure in product |
| --- | --- |
| Imagery mnemonics attempted live | Live protocol has no imagery step; imagery is an offline-only workshop |
| Single-photo flashcards | Image-variety gate; confidence capped until ≥ 3 images from ≥ 2 encounters |
| Restudy masquerading as practice | Answer is never co-presented with the prompt; every card is a test first |
| Neglecting sleep/stress | Pre-sleep consolidation slot; confounds logged and correlated in Insights |
| Chasing far transfer | No generic brain games exist in the app to chase |
| Expecting permanence | Maintenance queue is permanent and framed as such; no "mastered" state |
| **Review debt / abandonment spiral** | Daily load caps + triage by real-world value — see `02-engagement-design.md` §4 |

## 8. Realistic year-end claim (what the app promises)

Copied into the app's own onboarding, near-verbatim from the brief, because over-promising is
the fastest route to abandonment:

> You will reliably **capture** names you attend to, **retain** the ones you invest a few spaced
> retrievals in, and **retrieve** them faster and with less felt effort. You will not achieve
> effortless, permanent, universal recall — that contradicts the architecture, not your discipline.
