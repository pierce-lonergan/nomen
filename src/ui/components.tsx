import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { MediaRef, Person } from '../domain/types'
import { confidenceCeiling, FACE_CONFIDENCE_COPY } from '../domain/faceVariety'

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
 * Every statistic carries its `n`, and below the threshold the app shows the count instead of a
 * rate. Subjective memory gains reliably overstate real ones, so refusing to state a number you
 * cannot support is a feature of the product, not a limitation of the chart.
 */
export function Stat({
  label,
  value,
  n,
  insufficient,
  hint,
}: {
  label: string
  value: string
  n?: number
  insufficient?: boolean
  hint?: string
}) {
  return (
    <div className="stat">
      <div>
        <div>{label}</div>
        {hint && <div className="dim">{hint}</div>}
      </div>
      <div className={`stat-value${insufficient ? ' insufficient' : ''}`}>
        {insufficient ? `not enough data (n=${n ?? 0})` : value}
        {!insufficient && n !== undefined && <span className="dim"> n={n}</span>}
      </div>
    </div>
  )
}

export function Bar({ value }: { value: number }) {
  return (
    <div className="bar">
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function FaceConfidenceBadge({ person, media }: { person: Person; media: MediaRef[] }) {
  const level = confidenceCeiling(person, media)
  const cls = level === 'PHOTO_ONLY' ? 'warn' : level === 'ROBUST' ? 'good' : ''
  return (
    <div>
      <span className={`pill ${cls}`}>{level.replace('_', ' ').toLowerCase()}</span>
      <div className="dim" style={{ marginTop: 4 }}>
        {FACE_CONFIDENCE_COPY[level]}
      </div>
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
        <Link to={back} className="small">
          ← back
        </Link>
      )}
      <h1>{title}</h1>
      {sub && <p className="muted">{sub}</p>}
    </header>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="small">{body}</p>
      {action}
    </div>
  )
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip${value === o.value ? ' on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
