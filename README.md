# Nomen

**An evidence-led, local-first trainer for remembering people's names.**

Nomen is built from one research brief and one design constraint: train the mechanisms that
actually carry the load, and refuse to ship the ones that don't. That means the boring,
well-replicated things — attention at introduction, retrieval instead of restudy, spacing, saying
the name aloud, sleep — and *not* the glamorous ones: no memory palaces for conversational names,
no brain-training, no single-photo flashcard decks, no promise of permanence.

It is a self-contained web app with no backend, no account, and no network calls at runtime.

---

## Why names are hard (and what follows from it)

Names are arbitrary, semantically-impoverished labels. Knowing someone *is* a baker activates
ovens, bread, early mornings; knowing they are *called* Baker activates nothing. Retrieval
therefore hangs on a single fragile link from a person-identity representation to a phonological
word-form — reached last, after identity has already resolved, which is why "I know everything
about them except their name" is the architecture working as designed rather than a personal
failing.

Three consequences shape every feature:

| Fact | Consequence in the product |
| --- | --- |
| The one-minute failure is an **encoding** failure — you never attended to or clearly heard the name | The four-beat capture protocol is the highest-priority feature, and adherence is the leading metric |
| The face↔name link is arbitrary cross-domain binding, hippocampus-dependent and fragile | Spaced **retrieval** — not re-exposure — is the engine, and sleep is part of the protocol |
| Connections decay without recent use (transmission deficit) | There is no "mastered" state. Maintenance is permanent, and the app says so |

The full argument, with citations and confidence ratings, is in [`docs/`](#documentation).

## What the app does

**Capture** — a four-beat micro-protocol run at every introduction: **HEAR** (did it arrive? if
not, ask now) → **SAY** (aloud, in a sentence) → **LOOK** (at the face while saying it) → **HOOK**
(one association, five words). One field creates a valid person, because a capture flow that takes
a minute is a capture flow you skip. A ~20-second retrieval is scheduled immediately.

**Retrieve** — an early-then-expanding ladder: `20s → 2m → 10m → 1h → tonight → 1d → 3d → 1w → 3w
→ 2mo → 6mo`, graded on four levels including an explicit tip-of-the-tongue. The answer is never on
screen with the prompt, so restudy cannot masquerade as practice.

**Measure** — recall at fixed delays, protocol adherence per beat, retrieval latency with a
power-law fit, tip-of-the-tongue rate, and a confound breakdown that turns *"I'm bad with names"*
into *"I'm bad with names in loud rooms"*. Every figure carries its `n`; below ten it says so
instead of drawing a line.

**Progress** — five phases from baseline through maintenance, gated on measurements rather than
the calendar, with one deliberate exception (a 45-day floor in Phase 1, because habit automaticity
takes about two months and enthusiasm is not a substitute).

**Adjacent tracks** — cast names in books and film (situation-model work: roles and relationships,
not just names) and place names (the same left-temporal-pole machinery, and the one context where
the method of loci genuinely belongs).

## What it deliberately does not do

- **No brain training.** Generic cognitive training does not far-transfer, across 145 comparisons.
  Nomen trains names and adjacent, specific targets only.
- **No live imagery mnemonics.** The keyword-image method gives no benefit when attempted during
  real conversation — it collapses under divided attention. Heavy imagery is offline-only, for a
  small number of high-value people.
- **No single-photo decks.** Learning a face from one image trains you to recognise a photograph.
  A person's confidence ceiling is capped until you have looks from **different occasions**.
- **No promise of permanence.** The realistic year-end claim, stated in onboarding: you will
  reliably *capture* names you attend to, *retain* the ones you invest a few spaced retrievals in,
  and *retrieve* them faster and with less effort. Not effortless, not permanent, not universal.

## The engagement design

A year-long practice needs an engagement model, and this domain has three hazards that generic
habit design gets wrong. The full argument is in
[`docs/02-engagement-design.md`](docs/02-engagement-design.md); the short version:

1. **Supply is bursty and involuntary** — people walk in off the street. So a day counts when you
   clear your due retrievals *or* rest deliberately, never "met someone new" and never merely
   "opened the app". A quiet week is satisfiable.
2. **The reward happens off-app** — greeting someone correctly three weeks later. So the app sends
   **field missions** out into the world and brings the signal back, and the **Moment Journal**
   records the times it worked. That journal is the month-nine motivator.
3. **Review debt is what kills tools like this** — a flood week becomes a wall, and the wall is
   where people quit. So intake is **capped**, the queue is triaged by *who you'll actually see
   next*, and a one-tap **amnesty** spreads a backlog rather than demanding you clear it.

Rewards are informational, never tokens: a *Rescue* fires only when an item was genuinely about to
lapse, a *durability record* only when the interval really is a personal best. There are no points,
no loot, no leaderboard, and an explicit [anti-pattern charter](docs/02-engagement-design.md#6-anti-patterns-this-app-will-not-ship)
against guilt copy, manufactured urgency, and paid streak repair. The gamification meta-analyses
are the reason: points lift extrinsic motivation more than intrinsic, do almost nothing for
*competence*, and carry a documented overjustification risk — and competence is the one this app
must feed.

The loop's own assumptions are instrumented as five testable hypotheses, including one that is
adversarial toward the app's headline mechanic: *is the streak actually doing anything, or is
retrieval volume the whole story?* If the data says the streak is decorative, the streak should go.

## How it looks

**Nomen looks like a ruled instrument built to hold people's names, and the name is always the
largest thing on the page.** One 16px left rule runs down every screen; nothing is centred, because
a razor-straight left edge is what makes a page scannable by someone half asleep at 22:40.

Three voices, one job each — a grotesque for the instrument, a monospace with tabular figures for
everything measured, and **a serif for a human being's name and nothing else, anywhere.** That
reservation is the whole emotional argument: it makes the change of typeface itself the semantic
marker, so if it is in the serif, it is a person you care about. (A character in a novel is a
person. A place is not. The branch lives in the domain, with a test.)

The reveal — which happens ten to twenty times a night for a year — is a 2px terracotta rule
drawing itself left to right over 320ms with a serif name rising six pixels to land on it. No
flash, no burst, no haptic. The accent appears exactly once per card and that is it.

Where a number cannot be honestly stated, a figure dash sits in the number's slot, at the number's
size, with `n = 4 · needs 10` beneath it and the label at full strength — a refusal has the same
weight as an answer, because a refusal is an answer.

Full reasoning in [`docs/08-visual-system.md`](docs/08-visual-system.md).

## Running it

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 111 unit tests over the domain engines and the design laws
npm run build          # typecheck + production bundle
npm run check:contrast # fails on any token pair below WCAG AA, in either theme
npm run smoke          # optional: browser pass over every screen (needs a preview server)
```

There is no configuration and no environment file. Open **Settings → Generate demo history** to
populate a simulated eight months of practice — deterministic, clearly fictional, and safe to wipe
— so the Insights and Program screens have something to show.

## Structure

```
nomen/
├── docs/                     the argument: spec, engagement research, year program, evidence map, visual system
├── src/
│   ├── domain/               pure, dependency-free, fully unit-tested — the whole product's logic
│   │   ├── scheduler/        ladder · grading · cue ladder · load balancer
│   │   ├── metrics/          recall@delay · power-law latency · confound analysis
│   │   ├── program/          phase gates · daily plan
│   │   ├── engagement/       streak · rewards · missions
│   │   ├── assessment/       baseline routing verdict
│   │   └── drills/           the drill catalogue, with its evidence
│   ├── data/                 IndexedDB schema, export/import, demo generator
│   ├── state/                the single orchestration layer
│   └── ui/                   tokens.css, styles.css, screens, charts, icons
└── tests/                    vitest, over the domain only
```

**Invariant:** `domain/` imports nothing from `data/`, `state/`, `ui/`, or the DOM, and never reads
the clock — every function takes `now`. That is what makes a year-long expanding schedule testable
in milliseconds, and it is why the scheduling and gating rules can be checked against the evidence
map line by line.

## Privacy

The database is photographs, voice clips, and private notes about real people who never agreed to
any of this. So: local-only by construction, no account, photos optional, voice opt-in per person,
hard cascade delete with no trash, manual export. There is no code path that transmits a person's
data anywhere, because there is nowhere for it to go.

The honest residual: v1 has no at-rest encryption. This is as private as your phone's lock screen
and no more. See [`docs/06-privacy.md`](docs/06-privacy.md).

## Documentation

| Document | What's in it |
| --- | --- |
| [`01-product-spec.md`](docs/01-product-spec.md) | Problem, non-goals, the six modalities and the mechanism each targets, failure modes with shipped countermeasures |
| [`02-engagement-design.md`](docs/02-engagement-design.md) | Independent research on the domain loop: what the engagement literature supports, the five nested loops, the reward model, the anti-pattern charter |
| [`03-year-program.md`](docs/03-year-program.md) | Phases 0–4, gate criteria, weekly shape, and what the year does *not* deliver |
| [`04-architecture.md`](docs/04-architecture.md) | Scheduler algorithm, grading table, image-variety gate, metrics, persistence |
| [`05-evidence-map.md`](docs/05-evidence-map.md) | 27 claims → source → confidence → the code implementing it, plus deliberate omissions |
| [`06-privacy.md`](docs/06-privacy.md) | Commitments, what the app won't invite you to record, residual risk |
| [`08-visual-system.md`](docs/08-visual-system.md) | The design: three voices, the type-size law, the refusal, motion, and the charter enforced in CSS |
| [`07-roadmap.md`](docs/07-roadmap.md) | What's built, what's next, and what is explicitly out of scope |

## Evidence standard

Every mechanism-bearing feature traces to a claim in the evidence map with a confidence rating,
and features whose evidence is weak are de-scoped or shipped behind a caveat the UI itself states.
Two examples of that standard biting:

- **Expanding vs. uniform spacing** is a user-visible setting, not a hidden flag, because the
  literature genuinely disagrees (meta-analytic *g* ≈ 0.03). Shipping only one arm and implying
  certainty would contradict the app's own standard.
- **Targeted memory reactivation** is well-known and *not implemented*: it is hard to
  self-administer and has accumulated null results. Being interesting is not the bar.

Digital face-name training for healthy adults is essentially unstudied. The strongest controlled
evidence comes from small clinical samples. Nomen is built on the most replicated mechanisms
precisely because they are the safest bets — and it says so in onboarding rather than implying an
evidence base it does not have.
