# The Year Program — phases, gates, and what each phase is actually for

The brief is explicit that this is *"a mechanistic arc, not a calendar."* Nomen implements it that
way: **phases advance on measured criteria, never on elapsed time.** Weeks below are expectations,
not requirements. A user who plateaus stays put and is told why; a user who is already good at
encoding skips ahead.

The gate logic lives in `src/domain/program/gates.ts` and is unit-tested — the criteria in this
document and the code are the same thing.

---

## Phase 0 — Baseline & rule-outs
**Expected 1–2 weeks. Purpose: find out which stage is actually broken before training it.**

The brief's §9 is emphatic that several *non-memory* factors masquerade as bad name memory. Phase 0
rules them out, non-diagnostically.

| Step | What it measures | Why |
| --- | --- | --- |
| Face–name paired-associate baseline | encoding + binding, held-out items | primary outcome anchor |
| Face individuation screen | whether faces are individuated at all | you cannot bind a name to a face you did not encode distinctly |
| Name-in-noise screen | acoustic encoding under masking | the underrated cause; failures here are *hearing*, not memory |
| Confound questionnaire | sleep, stress, alcohol, attention, hearing | base rates, ruled out neutrally |

**Verdict engine output** — one of four routes, each changing the Phase 1 weighting:

- `ENCODING_ATTENTION` (the default and most common) → full weight on the micro-protocol.
- `PERCEPTUAL_INPUT` → noise drills, environment control, and a plain-language suggestion that an
  audiology check is reasonable. Explicitly *not* framed as a memory problem.
- `FACE_INDIVIDUATION` → Phase 1 adds face-variety work before name work.
- `RETRIEVAL_FLUENCY` → accuracy is fine, speed is the complaint; skip to Phase 2 with speed drills.

**Gate to Phase 1:** all four baseline instruments completed. That is all — Phase 0 is measurement,
and gating it on performance would be incoherent.

---

## Phase 1 — The encoding habit
**Expected ~8–12 weeks (Lally: median automaticity ≈ 66 days). Purpose: never lose a name you
attended to.**

This is where the user's stated one-minute-failure problem should largely resolve, and it is the
highest-leverage phase in the year **[brief: "the largest, cheapest win"]**.

- Daily: the micro-protocol on every introduction, plus the 20s front-loaded check.
- Low-stakes → high-stakes progression: baristas and shop staff → colleagues → parties and
  networking events, where self-focused attention is at its worst.
- Retrieval is deliberately light here: enough to keep names, not enough to compete with the habit.
- Field mission every day, always the same shape: *use a name aloud*.

**Gate to Phase 2 (all must hold):**
- protocol adherence ≥ 80% over a rolling 14 days, with ≥ 14 logged introductions;
- post-conversation recall ≥ 70% (n ≥ 15);
- ≥ 45 days since phase entry (habit-formation floor — this one *is* time-based, deliberately).

## Phase 2 — The retrieval engine
**Expected ~10–14 weeks. Purpose: turn captured names into retained names.**

- Full expanding schedule switched on, including the pre-sleep consolidation slot.
- Elaboration layer introduced: one semantic hook per person, offline imagery workshop for
  high-value people only.
- Cast track and place track begin — same engine, cheap volume, and they keep the streak
  satisfiable during socially quiet weeks.
- Image-variety enforcement becomes strict: a person cannot exceed "familiar" status on one photo.

**Gate to Phase 3:**
- recall@1week ≥ 65% (n ≥ 20);
- recall@1month ≥ 50% (n ≥ 10);
- ≥ 200 successful retrievals logged;
- image-variety coverage ≥ 60% of active people at ≥ 2 images.

## Phase 3 — Load, interference, fluency
**Expected ~12–16 weeks. Purpose: make it work under real conditions, and make it fast.**

- Volume up; similar-name interference sets introduced deliberately.
- Errorful retrieval with feedback becomes the default (desirable difficulty), with errorless
  fallback retained only for items that have lapsed 3+ times.
- Divided-attention drills — the direct answer to Patton (1994) and the specific-transfer
  principle. This is the phase that attacks the lab-to-life gap head-on.
- Speed runs: latency becomes a tracked target, not just accuracy.

**Gate to Phase 4:**
- median retrieval latency improved ≥ 30% vs. the Phase 2 baseline;
- interference-set accuracy ≥ 70%;
- divided-attention drill accuracy within 20 points of the undistracted equivalent;
- recall@1month ≥ 65% (n ≥ 20).

## Phase 4 — Maintenance & generalisation
**Ongoing. Purpose: keep only what survives without conscious effort.**

- Long-interval retrievals (2–6 months) test genuine durability.
- Prompts taper; the app deliberately reduces its own presence — the success condition is that the
  protocol fires without it.
- Quarterly re-baseline on held-out items.
- The maintenance queue never empties, and the app says why: unrehearsed names decay by design
  **[brief: transmission deficit is a fact of the architecture]**.

---

## Weekly shape (Phase 2 example)

| | Mon–Fri | Sat | Sun |
| --- | --- | --- | --- |
| Morning | context prompt: who you'll meet today | — | — |
| In the day | protocol on every intro + field mission | — | — |
| Pre-sleep | consolidation review (~2 min) | consolidation | consolidation |
| Extra | — | cast/place track (~5 min) | weekly report + rescue list (~5 min) |

Total: **~5 minutes a day**, plus the protocol, which costs nothing once it is a habit.

## What the year does not deliver

Restated because the program has to be honest to survive contact with month nine:

- Not effortless — **fast and fluent** is the achievable target.
- Not permanent — retained means *periodically re-retrieved*.
- Not universal — noise, fatigue, stress, and age still produce tip-of-the-tongue states, forever.
