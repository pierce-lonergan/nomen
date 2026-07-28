import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ONBOARDING, ONBOARDING_CTA } from '../../domain/onboarding'

/**
 * First run.
 *
 * The product spec commits the app to stating its realistic endpoint before anything else —
 * including, explicitly, the parts that are *not* achievable — and the evidence map lists that
 * as one of three shipped honesty rails. It was written and never wired up, which made the
 * single most load-bearing anti-over-promise commitment in the specification unreachable code.
 *
 * The panels are set as a reading sequence rather than a carousel: no dots, no swipe, no
 * auto-advance, one control. The headline of each is the largest type on its screen and it wears
 * the serif — these are the app's thesis statements, and the face is the same one it reserves for
 * the thing it is all about.
 */
export default function Onboarding() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const last = index >= ONBOARDING.length
  const panel = ONBOARDING[index]

  if (last) {
    return (
      <>
        <p className="retrieval__collection">last thing</p>
        <p className="answer__name">{ONBOARDING_CTA.headline}</p>
        <p className="standfirst" style={{ marginBlockStart: 'var(--s-4)' }}>
          {ONBOARDING_CTA.body}
        </p>
        <button className="primary full btn--lg" onClick={() => navigate('/baseline')}>
          Start the baseline
        </button>
        <button className="full ghost" onClick={() => navigate('/today')}>
          Later — take me in
        </button>
      </>
    )
  }

  return (
    <>
      <div className="retrieval__register">
        <span className="retrieval__mode">{panel.kicker}</span>
        <span className="retrieval__count mono">
          {String(index + 1).padStart(2, '0')} / {String(ONBOARDING.length).padStart(2, '0')}
        </span>
      </div>

      <p className="answer__name" style={{ marginBlock: 'var(--s-5) var(--s-4)' }}>
        {panel.headline}
      </p>

      {panel.body.map((para) => (
        <p key={para.slice(0, 32)} className="standfirst">
          {para}
        </p>
      ))}

      {panel.points && (
        <div style={{ marginBlockStart: 'var(--s-5)' }}>
          {panel.points.map((pt) => (
            <p key={pt.text} className="row row-rule" style={{ paddingBlock: 'var(--s-3)', margin: 0 }}>
              {/* "will" and "won't" are separated by a word and a rule style, never by red and
                  green — the unachievable half is not a warning, it is the specification. */}
              <span
                className="retrieval__mode"
                style={{ minInlineSize: '3.5rem', color: pt.kind === 'will' ? 'var(--ink-2)' : 'var(--ink-3)' }}
              >
                {pt.kind === 'will' ? 'will' : 'won’t'}
              </span>
              <span className="grow small" style={{ color: pt.kind === 'will' ? 'var(--ink)' : 'var(--ink-2)' }}>
                {pt.text}
              </span>
            </p>
          ))}
        </div>
      )}

      <div style={{ marginBlockStart: 'var(--s-6)' }}>
        <button className="primary full btn--lg" onClick={() => setIndex((i) => i + 1)}>
          {index === ONBOARDING.length - 1 ? 'Last thing' : 'Next'}
        </button>
        <button className="full ghost" onClick={() => navigate('/today')}>
          Skip
        </button>
      </div>
    </>
  )
}
