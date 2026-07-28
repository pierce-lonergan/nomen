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
- 87 unit tests over the domain layer; browser smoke test over every screen

## Next — highest leverage first

1. **Voice capture and the Voice → Name drill.** The registry and schedule modes exist; recording,
   playback, and the opt-in consent indicator do not. Targets the heteromodal naming hub, and is
   the second route in when the face route stalls.
2. **Context-triggered prompts (JITAI).** `shouldPrompt()` already decides *whether* to fire on
   vulnerability and receptivity; it needs a delivery mechanism — service worker + notifications,
   and optionally a calendar read so "you have standup at 10 with four people" is real rather than
   illustrative. This is the largest single retention lever still unbuilt.
3. **Name-in-noise as a training drill**, not only as a baseline instrument. Currently the
   `PERCEPTUAL_INPUT` route recommends drills that exist as an assessment but not yet as practice.
4. **Interference sets.** Auto-cluster phonologically similar names from the user's own roster and
   test them together (Phase 3). The registry entry is live; the clustering is not.
5. **Offline imagery workshop.** A guided keyword/interactive-image builder for the small set of
   high-value or thrice-lapsed people — deliberately unhurried, deliberately never live.
6. **PWA install + offline shell.** Manifest, service worker, icons. The app is already
   network-free at runtime; it just isn't installable yet.
7. **Weekly report loop.** The data exists on Insights; the Sunday five-minute ritual — report
   card, rescue list, journal review, drill unlock — needs its own surface.
8. **Parallel assessment forms.** Monthly re-tests currently redraw from one stimulus pool. Proper
   parallel forms would make the month-over-month comparison cleaner.

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
