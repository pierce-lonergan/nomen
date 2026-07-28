/**
 * First-run content.
 *
 * `docs/01-product-spec.md` §8 commits the app to stating its realistic endpoint up front, in
 * near-verbatim language from the research — including the parts that are *not* achievable. This
 * module holds that copy as data so it can be reviewed against the brief without reading JSX, and
 * so the claims live somewhere a reviewer can diff.
 *
 * Over-promising is not merely dishonest here; it is the fastest route to abandonment. A user who
 * was told they would remember every name forever discovers otherwise in month three and stops.
 * A user who was told the truth has no such moment waiting for them.
 */

export interface OnboardingPanel {
  /** A short kicker, set in the caps label style. */
  kicker: string
  /** The headline. Set in display serif — these are the app's thesis statements. */
  headline: string
  body: string[]
  /** Optional list rendered as an inline set of promises or refusals. */
  points?: { text: string; kind: 'will' | 'wont' }[]
}

export const ONBOARDING: OnboardingPanel[] = [
  {
    kicker: 'What this is',
    headline: 'A year-long practice, not a trick',
    body: [
      'Nomen trains one specific skill: keeping the names of people you meet. It is built from the mechanisms that actually carry the load — attention at the moment of introduction, retrieval instead of re-reading, spacing, saying the name aloud, and sleep.',
      'Everything glamorous has been deliberately left out. That is not modesty; it is what the evidence supports.',
    ],
  },
  {
    kicker: 'Why names are hard',
    headline: 'A name is a label attached to nothing',
    body: [
      'Knowing someone *is* a baker activates ovens, bread, early mornings. Knowing they are *called* Baker activates nothing at all. The name sits at the end of a chain, reachable only once you have already worked out who the person is.',
      'That is why “I know everything about them except their name” is the ordinary case rather than a personal failing. The architecture is working exactly as designed.',
    ],
  },
  {
    kicker: 'The good news',
    headline: 'Your one-minute failure is an encoding problem',
    body: [
      'When a name vanishes sixty seconds after you heard it, the usual cause is not a weak memory. It is that at the moment the name was spoken, your attention was on what to say next — or the room was loud and you never accurately heard it.',
      'That is the cheapest thing in this whole field to fix, and it is entirely under your control. It is where the app starts.',
    ],
  },
  {
    kicker: 'What to expect',
    headline: 'Fast and fluent. Not effortless.',
    body: [
      'After a year of daily practice, here is the honest forecast — the app will hold itself to it, and show you the measurements either way.',
    ],
    points: [
      { text: 'You will reliably capture names you attend to', kind: 'will' },
      { text: 'You will retain the ones you invest a few spaced retrievals in', kind: 'will' },
      { text: 'You will retrieve them faster, with less felt effort', kind: 'will' },
      { text: 'It will not become effortless — every new person is a new binding', kind: 'wont' },
      { text: 'Names you stop re-retrieving will still fade. That is the hardware, not your discipline', kind: 'wont' },
      { text: 'Noise, fatigue and stress will still produce tip-of-the-tongue moments, forever', kind: 'wont' },
    ],
  },
  {
    kicker: 'How it treats you',
    headline: 'No streaks worth gaming, nothing uploaded',
    body: [
      'Every number in this app carries the number of observations behind it, and below ten it declines to draw a trend at all. There are no points, no leaderboards, and no guilt.',
      'Your photographs, recordings and notes are about people who never agreed to any of this. They stay on this device. There is no account and no server — not as a policy, but because none was built.',
    ],
  },
]

/** Shown once, after the last panel — the single next action. */
export const ONBOARDING_CTA = {
  headline: 'Start with the baseline',
  body: 'Four short instruments, about ten minutes. They decide what you train first, and the four possible answers lead to genuinely different programmes — so it is worth not guessing.',
}
