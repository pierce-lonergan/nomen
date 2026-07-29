# The Long Room

A forward-only walk down a gallery at closing time. Sculpted strangers stand on plinths; among them,
cards for people you have actually met. You claim each one before you pass it, and you are told
nothing until the room ends — then they resolve, one at a time.

This document exists mostly to state, permanently and in writing, **what this mode is not**.

---

## 1. The 3D is staging. It is not a learning mechanism.

The intuitive case for 3D here is seductive and wrong, and the app's own evidence standard is what
kills it. The argument goes: face learning fails from a single image, variability is the fix, a
rotating head supplies variability. Every step after the first is false.

| Claim | What the evidence actually says |
| --- | --- |
| Multiple viewpoints of one capture aid face learning | **No.** Matthews, Ritchie, Laurence & Mondloch (2024), two experiments, *N* = 71 and 73. A low-variability set of six frames from one video — explicitly including changes in viewpoint and expression — performed *no better than a single static image*: BF₁₀ = 0.40 and 0.52, which is positive evidence **for** the null. A synthesised viewpoint sweep is that condition by construction. |
| Motion improves recognition across viewpoint | **No.** Dynamic learning improves generalisation to a *new expression* (d ≈ 0.44–0.67) and produces **no** improvement to a *new viewpoint*. The specific transfer this design would need is the one that fails. |
| Structure-from-motion builds a richer 3D face model | **Weakly supported at best.** Of O'Toole, Roark & Abdi's two accounts, the one with strong support after twenty years is *supplemental information* — idiosyncratic motion signatures, which require real video of a real person. *Representation enhancement*, the account a rotating model would need, has only limited support. |
| What does work | Images from **genuinely different days**, where hair, light, weight and health have changed: BF₁₀ in the millions, d′ 2.10 against 1.39. That is a photograph-collection problem, not a rendering problem. |

So the crowd in this room is **the crowd**: strangers to walk past, occluders that gate what is
available when, and a categorical foil population. Nothing more is claimed for it, in the code, in
the UI copy, or here.

Two consequences are enforced rather than hoped for:

- **A generated head is never used to represent a real person.** Training against a synthetic
  stand-in would be training the wrong face. When someone has no photograph the card falls back to
  the logged context, exactly as the plain Session does.
- **Test images are never study images** (Longmore, Liu & Young 2008: recognition is always highest
  for the exact studied image, so testing on it measures picture memory). Cards draw through the
  existing `nextDrillImage()` rotation.

## 2. It is an adherence bet, and it is labelled as one

The honest position: there is *no* located study measuring transfer from screen-based face learning
to live real-world recognition. The whole category is unmeasured. This mode is therefore justified
by engagement, not by learning, and if a delayed low-stakes probe ever shows it costs retention it
should be cut rather than defended.

The entertainment budget is spent where the gamification meta-analyses actually support it — game
fiction and difficulty calibration — and nowhere near a token economy.

## 3. How it honours the charter

`docs/02-engagement-design.md` §6 bans points, loot, leaderboards, guilt copy, manufactured urgency
and paid streak repair. Every mechanic here was chosen to deliver tension *without* those.

| Mechanic | Why it is not a token |
| --- | --- |
| **The shortening rule** — the app's own 16px left rule loses a third of its length per person who walks past | A rule that gets *shorter* states a true fact. A meter that *fills* would be the banned vocabulary. It dies at the run boundary, so it is a state, never a possession. |
| **The window** — a plate's rule retracting in eight discrete steps | Quantised deliberately so it steps rather than drains, and it never changes colour. Running out of time is not an error. |
| **The pitch ladder** — one chime per confirmation, ascending major pentatonic | Resets every room, dies at the run boundary, register-capped at 1600 Hz, re-rooted daily. Nothing accumulates. |
| **Duration as amplitude** — silence before a reveal, scaled to the interval at stake | Bound to a measured quantity, so it is informational feedback rather than decoration. It is also the only emphasis channel the visual system leaves open. |
| **The boss** — the person you are closest to losing, from `atRiskItems()` | A stake that is *computed*, not manufactured. Different every night because the queue is. On arrival every mechanic is stripped away: no crowd, no window, no rail. |
| **Only inaction ends a run** | A wrong answer never signals sub-maximal performance — the single largest undermining contingency in the reward literature (d ≈ −0.88). |
| **Grades are written per face, immediately** | No completion contingency (d ≈ −0.36). Quitting mid-run costs nothing; finishing a run rewards nothing. |

### The degenerate strategy, and why it is not blocked

Being wrong is free and only inaction ends a run, so the obvious exploit is to claim every card the
instant it is legible and take whatever falls out.

This is deliberately **not** blocked, because blocking it means punishing wrong answers. It is
instead self-defeating *in the domain*: a blind claim resolves to MISS, MISS drops the item two
rungs, and tomorrow's queue is longer for it. The cost is real, it is the truth, and the app states
it plainly in the room rather than hiding it in a scoring rule.

## 4. What it costs

**11 kB gzipped**, with no new runtime dependency. three.js is ~86 kB gzipped before drawing
anything; OGL would be ~15 kB and a sixth dependency. What this scene needs is one perspective
camera, one material, N rigid transforms and a frame loop — so `src/lib/gl/renderer.ts` is written
directly against WebGL2 and the dependency count stays at five.

Heads are generated from a 24-float identity vector by anchored radial-falloff displacement
(`src/lib/bust/`), sampled on the 1.2–2.2σ shell of a 24-sphere rather than i.i.d. around the mean —
drawing Gaussians produces a room of siblings, because the mass of a high-dimensional Gaussian sits
near its centre. Candidates are then separated by **silhouette** distance, not parameter distance,
because an outline is most of what survives at 60 px.

### The heads have no faces, and that is the design

They began as carved busts with deep eye sockets. At full size the sockets read as **gouges** —
wounds in a lump of stone. That is the uncanny valley reached from the sculptural side rather than
the photoreal one, and no amount of tuning the falloff fixed it.

Removing the face entirely did. These are milliner's blocks: smooth, blank, unmistakably objects.
The blank is better on every axis — impossible to make uncanny, far easier to make beautiful, and
*true*, because these heads are the people you do not know. A head with no face is exactly what
"someone whose face you have not got" looks like, and it can never be mistaken for a claim that the
app is teaching you a face.

Identity therefore lives entirely in the **silhouette** — skull width and depth, jaw, face length,
brow and nose ridge, occiput — which is also the only channel that survives at the 60 px these are
usually drawn at.

The remaining commitments: cranium enlarged ~12%; truncation at the clavicle with a clean section
cut; **no facial motion, ever** — rigid rotation only, since partial facial motion is a documented
valley trigger. If the scene needs life, the camera moves.

## 5. Accessibility

- The cards are **real DOM buttons** projected onto the scene, not canvas hit-tests. Canvas cannot
  be made accessible; a parallel focusable layer is the only pattern that works, so the interactive
  layer simply *is* the DOM. Keyboard: `1`–`9` claim, `Space` claims the nearest, `R` toggles the
  rail, `Esc` pauses.
- Under `prefers-reduced-motion` the frame loop is **cancelled, not slowed**, and the corridor
  renders as a still stack. A visible, keyboard-reachable pause control ships regardless, because
  the media query alone does not discharge WCAG 2.2.2 — most people never set the OS flag.
- The scene draws a still frame outside the loop, so a room entered while paused or in a background
  tab is never a black rectangle.
- No WebGL2, or reduced motion: no canvas at all, and the room falls back to the flow layout.
- Audio ships **off** by default with three states, and every tone has a structural equivalent on
  screen.

## 6. Where it is measured

Nothing here is a new metric. Every retrieval calls the same
`grade(itemId, grade, latencyMs, cueUsed, dividedAttention, now)` on an ordinary `FACE_TO_NAME`
item, so recall@delay denominators stay comparable with the plain Session and this mode cannot
quietly inflate them. Rail use lands as `FOUR_CHOICE`, which the existing metrics already exclude
from free recall. Overlapping windows set `dividedAttention` — a measurement, not a label.
