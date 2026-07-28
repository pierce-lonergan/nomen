/**
 * The icon set.
 *
 * Drawn rather than borrowed, on a 24×24 grid with a 1.5px stroke, round caps and joins, and
 * `currentColor` throughout so a single `color` change re-themes every icon. Each one is built
 * from the app's own vocabulary rather than from generic app-store symbols:
 *
 *   Today    a ring with a centred dot — the present moment, the thing in focus
 *   Capture  a plus, because the fastest possible gesture deserves the plainest possible mark
 *   People   an index: rows with leading dots, a directory of human beings, not a hamburger
 *   Insights a retention curve with a terminal dot — literally the chart this app draws
 *   Program  a path with milestone nodes — the phases, in order, going somewhere
 *
 * Optical sizing note: the stroked shapes are inset to 3–21 rather than filling 0–24, so that
 * icons of different silhouettes read as the same visual weight when set side by side. A plus
 * drawn to the full box always looks larger than a circle drawn to the full box.
 */

interface IconProps {
  size?: number
  stroke?: number
  /** Filled variants mark the active tab — a second, non-colour channel for selection state. */
  active?: boolean
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false as const,
  }
}

export function IconToday({ size = 22, stroke = 1.5, active = false }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r={active ? 3.25 : 2.25} fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconCapture({ size = 22, stroke = 1.5, active = false }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={active ? stroke + 0.35 : stroke}>
      <path d="M12 4.75v14.5M4.75 12h14.5" />
    </svg>
  )
}

export function IconPeople({ size = 22, stroke = 1.5, active = false }: IconProps) {
  const rows = [7.25, 12, 16.75]
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      {rows.map((y, i) => (
        <g key={y}>
          <circle
            cx="5.75"
            cy={y}
            r={active ? 1.6 : 1.35}
            fill={active || i === 0 ? 'currentColor' : 'none'}
            stroke={active || i === 0 ? 'none' : 'currentColor'}
            strokeWidth={stroke}
          />
          <path d={`M10 ${y}h8.5`} />
        </g>
      ))}
    </svg>
  )
}

export function IconInsights({ size = 22, stroke = 1.5, active = false }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      {/* The axis: an L, kept lighter than the data — the grammar of every chart in the app. */}
      <path d="M4.5 4.75v14.5h15" opacity={0.45} />
      {/* A forgetting curve: steep early loss, then a long shallow tail. */}
      <path d="M7 7.5c2.4 4.6 4.2 7 6.4 8.15 1.7.9 3.4 1.1 5.1 1.1" />
      <circle cx="18.5" cy="16.75" r={active ? 2 : 1.6} fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconProgram({ size = 22, stroke = 1.5, active = false }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <path d="M12 4.5v15" opacity={0.45} />
      <circle cx="12" cy="6" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.9" fill={active ? 'currentColor' : 'none'} strokeWidth={stroke} />
      <circle cx="12" cy="18" r="1.9" fill="none" strokeWidth={stroke} opacity={0.55} />
    </svg>
  )
}

// ── Utility icons ─────────────────────────────────────────────────────────────

export function IconBack({ size = 18, stroke = 1.6 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  )
}

export function IconCheck({ size = 18, stroke = 1.9 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <path d="M5 12.5 9.75 17 19 6.75" />
    </svg>
  )
}

/** An open circle for an unticked protocol beat. Deliberately not an empty checkbox square. */
export function IconCircle({ size = 18, stroke = 1.5 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <circle cx="12" cy="12" r="7.25" opacity={0.5} />
    </svg>
  )
}

export function IconSun({ size = 18, stroke = 1.5 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M5.64 5.64l1.6 1.6M16.76 16.76l1.6 1.6M18.36 5.64l-1.6 1.6M7.24 16.76l-1.6 1.6" />
    </svg>
  )
}

export function IconMoon({ size = 18, stroke = 1.5 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <path d="M19 14.6A8 8 0 0 1 9.4 5a8.001 8.001 0 1 0 9.6 9.6Z" />
    </svg>
  )
}

/** Used on the at-risk list. A waning arc, not a warning triangle — decay, not danger. */
export function IconWaning({ size = 16, stroke = 1.5 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={stroke}>
      <circle cx="12" cy="12" r="7.5" opacity={0.35} strokeDasharray="2.5 3" />
      <path d="M12 4.5a7.5 7.5 0 0 1 0 15" />
    </svg>
  )
}
