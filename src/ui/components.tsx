import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isHuman, type MediaRef, type Person } from '../domain/types'
import { confidenceCeiling, FACE_CONFIDENCE_COPY } from '../domain/faceVariety'
import { IconBack } from './icons'

export function Avatar({ person, media }: { person: Person; media: MediaRef[] }) {
  const img = media.find((m) => m.personId === person.id && m.kind === 'IMAGE')
  if (!img) {
    return (
      <div className="avatar placeholder" aria-hidden>
        {person.displayName.charAt(0).toUpperCase()}
      </div>
    )
  }
  return <img className="avatar" src={img.src} alt="" />
}

/**
 * A person's name, set in the serif — the only place that family appears in the application.
 *
 * `track` matters: a character in a novel is a person and gets the serif; a **place is not**.
 * CAST and PERSON share the `Person` type, so the branch has to be on the data rather than on
 * the component, and it is covered by a test for exactly that reason.
 */
export function PersonName({ person, className = '' }: { person: Person; className?: string }) {
  return (
    <span className={`${isHuman(person.track) ? 'person-name ' : ''}${className}`.trim()}>
      {person.displayName}
    </span>
  )
}

/**
 * The honesty rail.
 *
 * A refusal occupies the number's slot, at the number's size, on the number's baseline, in the
 * same column — the row keeps its exact height and position. The label is **not** dimmed: dimming
 * the row is what makes an honest state read as a broken one, and insufficiency here is a mode,
 * not a fault.
 *
 * The mark is a figure dash (U+2012), which is tabular-width by definition. Both the dash and the
 * shortfall are real DOM text rather than generated content, so the rail is selectable, announced
 * by screen readers, and present in the accessibility tree.
 */
export function Stat({
  label,
  value,
  unit,
  n,
  needs,
  insufficient,
  hint,
  variant,
}: {
  label: string
  value: string
  /** Rendered small and dim beside the figure, so "62" and "%" don't compete. */
  unit?: string
  n?: number
  /** The threshold this figure needs before the app will state it. */
  needs?: number
  insufficient?: boolean
  hint?: string
  variant?: 'streak'
}) {
  const short = insufficient && n !== undefined && needs !== undefined
  return (
    <div className={`stat${variant ? ` stat--${variant}` : ''}`} data-sufficient={insufficient ? 'false' : 'true'}>
      <div className="stat__label">
        <span className="stat__name">{label}</span>
        {hint && <span className="stat__hint">{hint}</span>}
      </div>
      <div className="stat__read">
        <span className="stat__value">
          {insufficient ? '‒' : value}
          {!insufficient && unit && <span className="stat__unit">{unit}</span>}
        </span>
        {n !== undefined && (
          <span className="stat__n">
            {short ? `n = ${n} · needs ${needs}` : `n = ${n}`}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * The adherence meter. A ruler that cannot fill — it renders at its final width on mount and its
 * transition is disabled in the stylesheet, so there is no path by which it becomes a game meter.
 */
export function Bar({ value, sufficient = true }: { value: number; sufficient?: boolean }) {
  return (
    <div className="bar" data-sufficient={sufficient ? 'true' : 'false'}>
      <span style={{ inlineSize: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function FaceConfidenceBadge({ person, media }: { person: Person; media: MediaRef[] }) {
  const level = confidenceCeiling(person, media)
  // Insufficiency is neutral. PHOTO_ONLY is a shortfall in the app's records, not an alarming
  // fact about a person, and it is the same judgement People.tsx makes for the re-encode flag.
  const cls = level === 'ROBUST' ? 'good' : ''
  return (
    <div>
      <span className={`pill ${cls}`.trim()}>{level.replace('_', ' ').toLowerCase()}</span>
      <p className="dim" style={{ marginBlockStart: 'var(--s-2)' }}>
        {FACE_CONFIDENCE_COPY[level]}
      </p>
    </div>
  )
}

/** The in-app explanation of why a thing exists. Users who know why still do it in month nine. */
export function Evidence({ children }: { children: ReactNode }) {
  return <div className="evidence">{children}</div>
}

export function Header({ title, sub, back }: { title: string; sub?: string; back?: string }) {
  return (
    <header>
      {back && (
        <Link
          to={back}
          className="small"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-1)', minBlockSize: 'var(--tap)' }}
        >
          <IconBack />
          Back
        </Link>
      )}
      <h1>{title}</h1>
      {sub && <p className="standfirst">{sub}</p>}
    </header>
  )
}

/**
 * An empty state is not an error and not a degraded screen — same sizes, same ink, nothing dimmed.
 * The lapse-and-return state is typographically identical to a good day, which is the charter's
 * no-guilt rule expressed as a visual invariant rather than trusted to copy.
 */
export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}

/**
 * A single-select chip group.
 *
 * Declaring `role="radiogroup"` obliges the component to honour the radiogroup keyboard contract,
 * and announcing as a radio while ignoring the arrow keys is worse than announcing as a button —
 * a screen-reader user in forms mode presses Right, nothing happens, and the control reads as
 * broken. So: roving tabindex (the group is one tab stop, not N) and arrow keys that move the
 * selection with wrap-around.
 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
    if (!forward && !back) return
    e.preventDefault()
    const current = options.findIndex((o) => o.value === value)
    const next = (current + (forward ? 1 : -1) + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className="chips" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          className={`chip${value === o.value ? ' on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A section heading: a word and a line. Never a box, never a background. */
export function Section({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>
}
