# The visual system

> **Nomen looks like a ruled instrument built to hold people's names, and the name is always the
> largest thing on the page.**
>
> When a detail is in dispute, ask: *does this make the name bigger, the rule straighter, or the
> claim more honest?* If it does none of the three, it does not ship.

This document is the argument. The enforceable parts live in `src/ui/tokens.css`,
`src/ui/styles.css`, `tests/typography.test.ts` and `scripts/check-contrast.mjs` — where they can
be checked rather than remembered.

---

## 1. Three voices, one job each

| Face | Job | Never used for |
| --- | --- | --- |
| **Sans** (`system-ui`) | The instrument: every heading, label, control, and word of prose | Numbers |
| **Mono** (`ui-monospace`) | Everything measured: every value, interval, latency, and every `n` | Prose |
| **Serif** (`ui-serif` → Sitka Text → Noto Serif → Georgia) | **A human being's name, and nothing else, anywhere in the application** | Everything else |

The serif reservation is the emotional argument of the whole design. A screen of grey monospace
numerals with one warm serif name set into it is precisely what this app is about — and it makes
the *change of face itself* the semantic marker: **if it is in the serif, it is a person you care
about.**

That law has one hard edge. `PERSON`, `CAST` and `PLACE` all ride the same `Person` record, so:

- a **character in a novel is a person** and takes the serif;
- a **place is not**, and takes the sans;
- a **role** ("the sister who runs the press") is not a name, so it takes the sans even though the
  subject behind it is a person.

The branch is `isHuman(track)` in `src/domain/types.ts` — in the domain, not the component, so it
can be tested without a DOM. It is. This is a live bug surface: three separate places in `Session`
leaked names into the sans before the audit caught them (the cue ladder, the cast prompt, and
reward copy).

### Where the serif degrades, honestly

`ui-serif` is Safari-only. On Chrome/Android the stack lands on Noto Serif, on Windows on Sitka
Text or Georgia, on a bare Linux image on DejaVu Serif. **Realistically: four different typefaces
on four platforms.**

That is survivable *only because the serif is used in one role, at one large size, for two or three
words at a time*, which is the exact condition under which platform variance reads as character
rather than as breakage. It would not survive being used for body prose, which is why it is not.
`font-size-adjust: 0.48` normalises apparent size across the fallbacks; nothing in the layout
depends on it.

**No font is ever fetched.** There is no network at runtime — not for fonts, not for anything.

---

## 2. The type scale

Seven sizes, three weights. The gaps are deliberate: nothing sits between 19 and 24, or between 24
and 28, or between 28 and 32, so every element must declare whether it is chrome, prose, a
measurement, or a person. Adding an eighth size requires deleting one.

| Token | px | Face | For |
| --- | --- | --- | --- |
| `--t-name` | 32→38 | serif | **A person's name.** The ceiling of the entire system. |
| `--t-figure` | 28 | mono | The one large numeral per screen — and the figure dash that replaces it |
| `--t-title` | 24 | sans | Screen `<h1>`, one per screen |
| `--t-lede` | 19 | sans | Standfirst, the competence statement, a journal entry, a name in a list |
| `--t-body` | 16 | sans | All prose, capped at a 68-character measure |
| `--t-meta` | 14 | sans/mono | **The honesty rail.** Every `n`, every caveat, every hint |
| `--t-kicker` | 12 | sans | Section labels, tab labels, pills — never the sole carrier of information |

### The type-size law

**No figure may ever be set larger than a person's name.** `--t-figure` (28px) is below the
`--t-name` floor (32px) at every viewport, and the gap only widens.

This is the charter expressed as arithmetic rather than discipline: the streak renders at
`--t-lede` and the lifetime retrieval count at `--t-figure` directly beneath it, so **the number
that resets is literally the smaller number**, and no future vanity metric has a slot in the
hierarchy big enough to land in. `tests/typography.test.ts` asserts both.

---

## 3. Colour

Warm bone by day, warm near-black at night. Never white-on-black, never `#000`. Dark `--ink` lands
near 14:1 rather than 16:1 on purpose — light glyphs on dark bleed optically and dark screens
dilate the pupil, so past roughly 15:1 the gain is glare, not legibility.

**One accent: terracotta.** Its written job is **position and structure only** — the active tab, a
section rule, the rule under a revealed name, one primary action per screen. It never means good,
bad, due, overdue or urgent.

That last constraint is not aesthetic. This product's thesis is that failing to produce a name is
*the architecture working as designed* — "I know everything about them except their name" is the
predicted default. Colouring a miss red would contradict the research the app is built on. So the
grade buttons run neutral → accent through a single hue, and there is **no green and no red** among
them.

The accent replaced an amber-gold for the same kind of reason: amber-gold is the colour of a reward
token, and this app must never look like it awards badges. Terracotta is the colour of a pigment.

Three further rules, stated at the top of `tokens.css`:

1. **No tinted fill carries state.** A translucent accent at 8–14% measures 1.1–1.3:1 against its
   surface — invisible to a large fraction of users and to everyone at low brightness. State is a
   ≥3:1 border plus a glyph plus a word.
2. **`--bad-text` is scoped to destructive confirmation in Settings.** Never a lapse, never an
   overdue item, never insufficient data. **Insufficiency is neutral.**
3. **`--hairline` is decorative** and never bounds a control.

`npm run check:contrast` parses the token file, resolves both themes, and fails the build on any
pair below WCAG AA. 40/40 pass.

---

## 4. Motion

Two jobs — *reveal* and *settle* — always subordinate to a state change that is also expressed
structurally. Nothing loops, pulses, shimmers, overshoots, scales or bounces. Nothing exceeds
320ms. No element animates toward a brighter colour, so the screen can never get brighter than it
was. One curve: `cubic-bezier(0.2, 0, 0, 1)`.

**The app contains zero `@keyframes`.** Every transition is a CSS `transition` on a mounted element
driven by a `data-*` flip, which is what makes the reduced-motion path *provably* land on the true
end state — the end state is an ordinary rule, not an animation's fill mode.

**The reveal** is the one that matters, because it happens ten to twenty times a night for a year:
the gate unmounts, a dashed rule fades over 140ms, a 2px terracotta rule draws itself left to right
over 320ms, and 40ms into that draw the name rises six pixels and lands on it. No flash, no burst,
no haptic. The accent appears exactly once per card and this is it.

**Reduced motion is no motion**, not faster motion — one global block zeroes every duration and
kills the two meaningful transforms. There is no animation in this app that carries information the
static frame does not; that is the test a new transition must pass.

**Charter compliance is enforced in the stylesheet**, not requested in review:

```css
.bar > span,
.viz-bar-fill { transition: none !important; animation: none !important; }
```

The only meter in the app renders at its final width on mount. No number counts up. There is no
skeleton shimmer — the loading state is the same figure dash used for insufficient data, so
"waiting" and "not enough yet" are visually of a piece.

---

## 5. The refusal

The second-most important component after the name.

Where a number cannot be honestly stated, a **figure dash sits in the number's slot, at the
number's size, on the number's baseline, in the same column**, with `n = 4 · needs 10` beneath it.
The row keeps its exact height and position, and **the label is not dimmed** — dimming the row is
what makes an honest state read as a broken one.

A refusal has the same weight as an answer, because a refusal *is* an answer.

Both the dash and the shortfall are real DOM text, so the rail is selectable, announced, and in the
accessibility tree. In the charts, the same idea: a point below threshold renders **hollow, never
faded** — faded reads as *disabled*, hollow reads as *measured, not yet enough to join* — and the
trend line breaks around it. Where a trend would go and cannot, the axis is drawn and left bare.

---

## 6. Data visualisation

Every chart in Nomen plots **one series** — recall by delay, adherence per beat, latency over
practice, recall split by noise. All are one measure over an ordered dimension, which makes the
colour job **sequential, not categorical**: one accent hue plus grey.

**There is no categorical palette in this app and none is to be added.** Where a chart has named
categories, every bar is the same hue and identity comes from the row's own permanently-visible
text label — so categorical colour is never the sole carrier of identity, because it does not
exist. A future two-series chart would be distinguished by stroke style and a direct end label.

Marks are fixed: 2px lines with round caps; solid dots r 4.5 with a 2px surface ring; hollow sparse
dots; bars ≤8px with a 4px rounded data end and a square baseline; hairline solid gridlines, always
recessive; exactly one direct label, on the most recent solid point, never a number on every dot.

Every chart carries a **table view**, which is both the accessibility channel and the fair way to
show the `n` behind each point.

---

## 7. Anti-patterns, in code

The charter (`02-engagement-design.md` §6) binds the visuals as much as the copy:

- No manufactured urgency, countdown, or pressure. No guilt copy — the empty state after a lapse is
  **typographically identical to a good day**, which is the no-guilt rule expressed as a visual
  invariant rather than trusted to prose.
- No badge, no filled counter, no score. A number that needs attention is **set larger, never
  redder**.
- No box-shadow with a blur radius anywhere. Elevation is a border and a surface step.
- Nothing is centred. One 16px left rule runs down every screen, all year.
- Every screen terminates in a rule — a page has a visible end, which is the structural opposite of
  an infinite feed.
- **The one typographic celebration in the application** is a three-line terracotta initial on the
  capability statement, which fires on a met gate roughly every 6–12 weeks. Its rarity *is* the
  celebration; a second use anywhere deletes the first.

---

## 8. Accessibility

Not a pass at the end — several of these were found by measuring, and each was a real defect:

- Every foreground/background pair is gated at AA by a build script, both themes.
- One global `:focus-visible` rule. There was previously none anywhere in the app.
- 44px minimum target, 56px for night-time primaries.
- Identity is never colour alone. The grade buttons carry word + border-style + border-weight +
  tone; a completed protocol beat changes its *icon shape*; the active tab has a moving rule, a
  filled icon element, an ink step, a weight step and `aria-current`.
- Disabled controls use an ink token that still clears 4.5:1, never `opacity`. A disabled primary
  loses its fill entirely rather than dimming its label.
- Border-style rather than colour does the work under `forced-colors`, where `box-shadow` would not.
- Full `prefers-reduced-motion` and `prefers-contrast: more` support.
