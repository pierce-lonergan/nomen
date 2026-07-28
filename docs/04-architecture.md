# Architecture

## 1. Shape

Local-first PWA. **No backend, no account, no network calls at runtime.** React 19 + TypeScript +
Vite; IndexedDB for everything including photo and audio blobs; Zustand for view state.

The reason is not minimalism — it is that the corpus is photographs, voice clips, and private
notes about real people who did not consent to being uploaded anywhere. See `06-privacy.md`.

```
src/
  domain/          pure, dependency-free, unit-tested — the whole product's logic lives here
    types.ts
    scheduler/     schedule.ts · cueLadder.ts · loadBalancer.ts
    metrics/       recall.ts · latency.ts · confounds.ts
    program/       gates.ts · dailyPlan.ts
    engagement/    streak.ts · rewards.ts · missions.ts
    assessment/    battery.ts · verdict.ts
    drills/        registry.ts
  data/            db.ts (IndexedDB schema) · repo.ts (persistence) · seed.ts
  state/           store.ts (Zustand, orchestrates domain + data)
  ui/              screens/ · components/
```

**Invariant:** `domain/` imports nothing from `data/`, `state/`, `ui/`, or the DOM. It is a library
of pure functions over plain data, which is why the scheduling and gating rules can be tested
exhaustively and why the evidence-to-code traceability in `05-evidence-map.md` is checkable.

Time is always injected (`now: number`), never read from the clock inside domain code — this is
what makes a year-long expanding schedule testable in milliseconds.

## 2. The scheduler

An item is a `(person, mode)` pair — the same person carries independent schedules for
`FACE_TO_NAME`, `NAME_TO_FACE`, and `VOICE_TO_NAME`, because those are different retrieval routes
through the Bruce & Young flow and they demonstrably dissociate.

### Ladder
```
20s → 2m → 10m → 1h → tonight(pre-sleep) → 1d → 3d → 1w → 3w → 2m → 6m → 6m…
```
Front-loaded on purpose: Toppino, Phelan & Gerbier (2018) find expanding schedules win precisely
when initial learning is weak — which is the state of a name heard 20 seconds ago — and the
benefit depends on the *first* retrieval succeeding.

### Grading
Four grades, each with a defined schedule consequence:

| Grade | Meaning | Effect |
| --- | --- | --- |
| `MISS` | could not retrieve | drop 2 rungs (min 1); lapse++; cue ladder one step easier next time |
| `CUED` | needed a cue (a TOT state) | drop 1 rung; logged separately as a TOT event |
| `GOT` | retrieved unaided | advance 1 rung |
| `INSTANT` | retrieved unaided and fast (< 1.5s) | advance 1 rung, ×1.3 interval bonus |

Latency is recorded on every attempt regardless of grade — it is the fluency signal, and by
Phase 3 it is a target in its own right.

**Leech handling:** 3 lapses flags the item for **re-encoding**, not more drilling. The diagnosis
is an encoding failure (bad photo, no hook, name never heard clearly), so the app routes to fixing
the *record* rather than grinding a broken one. This is the one place the app recommends the
offline imagery workshop.

**`uniform` mode** is a first-class setting, not a hidden flag: the expanding-vs-uniform question
is unresolved (Latimier et al. 2020, g ≈ 0.03). Shipping only one and implying certainty would
contradict the app's own evidence standards.

### Cue ladder
`FREE → SEMANTIC_CONTEXT → INITIAL_LETTER → SYLLABLE_PHONEME → FOUR_CHOICE → RESTUDY`

Default is errorful-with-feedback (desirable difficulty). Errorless mode — cue offered *before*
the attempt — is reserved for items with ≥ 3 lapses, matching the brief's finding that errorless
learning helps the severely impaired but is not the default for a healthy adult.

### Load balancer
Prevents the documented review-debt abandonment spiral:
`intakeCap` (5 new/day) · `dailyCeiling` (25 retrievals) · value-first triage by
`likelihoodOfMeetingAgain` · `amnesty()` redistributes a backlog across N days.

## 3. Image variety — enforced, not suggested

`confidenceCeiling(person)` is a hard cap derived from image count and distinct encounters:

| Images | Distinct encounters | Ceiling |
| --- | --- | --- |
| 1 | 1 | `PHOTO_ONLY` — "you know a picture, not a face" |
| 2 | 1 | `PHOTO_ONLY` — same-encounter images do not count as variety |
| ≥ 2 | ≥ 2 | `FAMILIAR` |
| ≥ 3 | ≥ 3 | `ROBUST` |

Matthews et al. (2024): *"Multiple images captured from a single encounter do not promote face
learning"* — hence the *distinct encounters* term rather than a raw photo count. Drills refuse to
serve the same image twice consecutively for a person.

## 4. Metrics

- `recallAtDelay()` buckets attempts into POST_CONVERSATION (<1h) · NEXT_DAY · ONE_WEEK · ONE_MONTH
  and reports proportion **with n**. Below n = 10 it returns `insufficient: true` and the UI
  refuses to plot a trend.
- `fitPowerLaw()` fits `RT = a·N^(−b) + c` over successful retrievals by coarse grid search —
  enough to answer "am I getting faster, and is it flattening?" without pretending to precision.
- `confoundBreakdown()` splits recall by logged noise/alcohol/sleep/stress at encoding and reports
  the gap. This is what turns "I'm bad with names" into "you are bad with names *in bars*," which
  is a different and more tractable problem.

## 5. Persistence

IndexedDB via `idb`. Stores: `people · media · items · attempts · sessions · missions · moments ·
assessments · settings · streak`. Blobs live in `media` keyed by id so records stay small.

Export is a single JSON file plus base64 media; import restores it. Delete-person is a hard
cascade delete, not a soft flag — see `06-privacy.md`.
