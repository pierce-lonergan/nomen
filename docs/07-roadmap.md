# Roadmap

Mirrors the GitHub issue backlog. Sequenced by leverage against the research, not by ease.

## Built (v0.1)

- Four-beat capture micro-protocol with per-beat adherence logging and confound capture
- Early-then-expanding retrieval ladder, four-level grading, deterministic jitter, leech → re-encode
- Graded cue ladder with errorful default and errorless fallback after repeated lapses
- Load balancer: intake cap, daily ceiling, value-first triage, one-tap amnesty
- Image-variety enforcement by *distinct encounters*, with no-repeat drill image rotation
- Metrics: recall@delay with `n` gating, power-law latency fit with weak-fit suppression,
  tip-of-the-tongue rate, divided-attention gap, five-factor confound analysis
- Phase 0–4 program with measured gates and an honest capability statement
- Phase 0 baseline battery: face–name, face individuation, name-in-noise, confound screener,
  plus the four-way routing verdict
- Streak with earned freezes, rest days, and prehistory-safe recomputation; field missions;
  informational rewards; Moment Journal
- Cast and place tracks
- Local-first IndexedDB persistence, export/import, hard cascade delete, deterministic demo data
- 87 unit tests over the domain layer; browser smoke test over every screen (207 as of v0.3)

## Built (v0.2 — the visual system)

- A complete design system: tokens for both themes, a seven-step type scale, seven named
  transitions and zero `@keyframes`. The argument is in `08-visual-system.md`.
- The serif reserved to human names, branched in the domain and covered by tests
- The retention curve, adherence bars and latency curve wired into Insights, with sparse points
  rendered hollow and unjoined so a trend line cannot claim more than the data
- A drawn icon set replacing the text glyphs; light / dark / system theming with a pre-sleep variant
- **Onboarding**, which states the achievable *and unachievable* outcomes before anything else —
  previously specified, written, and never wired up
- `npm run check:contrast` as a build gate, and 12 tests asserting the design laws

## Built (v0.3 — the room, the drills, and the plumbing)

- **The Long Room**: a 3D gallery mode over the real due queue. Staging, never a learning claim —
  see `09-the-long-room.md` for the measured result that closed that door.
- **The drill catalogue is complete.** Every one of the nine drills can now actually run. Name →
  Face schedules at Phase 2 with a backfill; Voice → Name is minted per person on consent; Name in
  noise, Speed run and Interference ship as session variants of the face drill, the way Under load
  already did.
- **Interference clustering**: phonologically competing names are found on your own roster, placed
  adjacent in the queue, and used as each other's four-choice foils.
- **Voice capture**: hold-to-record, eight-second cap, opt-in globally and per person.
- **Review nudges**: local notifications with no server, gated on quiet hours and one per day.
- **Installable and offline**: manifest, icons, service worker; verified loading with the network
  genuinely disconnected.
- Photographs stored as Blobs rather than base64; atomic multi-store writes; validated imports.

## Next — highest leverage first

1. **Weekly report loop.** The data exists on Insights; the Sunday five-minute ritual — report
   card, rescue list, journal review — needs its own surface.
2. **Parallel assessment forms.** Monthly re-tests currently redraw from one stimulus pool. Proper
   parallel forms would make the month-over-month comparison cleaner.
3. **Calendar-aware prompts.** `shouldPrompt()` now has a delivery mechanism, but it fires on the
   app's own state. A calendar read would make "standup at 10 with four people" real rather than
   illustrative.
4. **Offline imagery workshop.** A guided keyword/interactive-image builder for the small set of
   high-value or thrice-lapsed people — deliberately unhurried, deliberately never live.
5. **The delayed probe for the Long Room.** The mode is an adherence bet and is labelled one. The
   only instrument that can test it is a delayed, low-stakes probe on novel images at ≥1 week. If
   that comes back negative the mode should be cut, however good it feels.

## Considered and deliberately not built

| Idea | Why not |
| --- | --- |
| Targeted memory reactivation (audio cueing during sleep) | Impractical to self-administer, and the literature has accumulated null results |
| Generic memory games / a "memory score" | No far transfer, and no validated construct — it would invite exactly the self-deception the brief warns about |
| Live imagery coaching during conversation | Collapses under divided attention; this is a documented failure, not an untested idea |
| Photo-import decks from social media | Trains photograph recognition, not face recognition — and consent-wise it is the wrong shape entirely |
| Cloud sync / accounts / sharing | The corpus is other people's faces. There is no version of uploading that improves this product enough to justify it |
| Leaderboards, social comparison, streak-repair purchases | Charter violations — see `02-engagement-design.md` §6 |

## Open questions worth resolving with data

These are the instrumented hypotheses from the engagement design, answerable on a single user's own
history once there is enough of it:

- Is the pre-sleep slot really the strongest habit anchor, or just the most obvious one?
- Do field missions move real-world recall more than the equivalent time spent on extra drills?
- Does intake capping measurably prevent lapse, or is it solving a problem this user doesn't have?
- Does reviewing the Moment Journal predict next-week adherence better than the streak does?
- **Is the streak doing any work at all**, once retrieval volume is controlled for? If not, remove it.
