import { useId, useState } from 'react'
import type { SeriesPoint } from '../domain/metrics/series'
import { canDrawTrend } from '../domain/metrics/series'

/**
 * The chart language.
 *
 * Every chart in Nomen plots **one series**. Recall by delay, adherence per beat, latency over
 * practice, recall split by noise — all of them are one measure over an ordered dimension. That
 * makes the colour job *sequential*, not categorical: one accent hue plus grey, which is both the
 * correct answer by the data's job and, conveniently, the restrained answer the app's charter
 * wants. There is no categorical palette here because nothing in this app needs one.
 *
 * Fixed marks across every chart:
 *   line      2px, round join/cap
 *   dot       r ≥ 4, with a 2px ring in the surface colour so it stays legible over the line
 *   bar       ≤ 24px thick, 4px rounded data-end, square at the baseline, 2px surface gap
 *   grid      hairline, solid, one step off surface, always recessive
 *
 * Two rules carry the app's honesty rails into the ink itself:
 *
 * 1. **A point built on too few observations is never joined into a line.** It renders hollow and
 *    the line breaks around it. A confident curve drawn through two observations is a lie told in
 *    ink, and it is exactly the lie this app exists not to tell.
 * 2. **Every chart has a table view.** Identity and value are never conveyed by mark alone, which
 *    is both the accessibility requirement and a fair way to show the `n` behind each point.
 */

const PAD = { top: 14, right: 18, bottom: 30, left: 34 }

interface ChartFrameProps {
  title: string
  /** Rendered under the title — say what is plotted and over what. */
  caption?: string
  rows: { label: string; value: string; n: number }[]
  children: React.ReactNode
  /** Shown instead of the plot when there is not enough data to draw anything honest. */
  fallback?: string
  height?: number
}

function ChartFrame({ title, caption, rows, children, fallback, height = 150 }: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()

  return (
    <figure className="viz">
      <figcaption className="viz-head">
        <div>
          <span className="viz-title">{title}</span>
          {caption && <span className="viz-caption">{caption}</span>}
        </div>
        <button
          type="button"
          className="viz-toggle"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((s) => !s)}
        >
          {showTable ? 'Chart' : 'Table'}
        </button>
      </figcaption>

      {showTable ? (
        <div className="viz-table-wrap" id={tableId}>
          <table className="viz-table">
            <thead>
              <tr>
                <th scope="col">{title}</th>
                <th scope="col">Value</th>
                <th scope="col">n</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="mono">{r.value}</td>
                  <td className="mono dim">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : fallback ? (
        <div className="viz-fallback" style={{ minHeight: height }}>
          <span>{fallback}</span>
        </div>
      ) : (
        children
      )}
    </figure>
  )
}

// ── Curve: an ordered series with a value per position ────────────────────────

export function Curve({
  points,
  title,
  caption,
  format,
  yMax = 1,
  height = 150,
  invertGood = false,
}: {
  points: SeriesPoint[]
  title: string
  caption?: string
  format: (v: number) => string
  yMax?: number
  height?: number
  /** True when lower is better (latency) — flips which end gets the emphasis label. */
  invertGood?: boolean
}) {
  const width = 320
  const plotted = points.filter((p) => p.y !== null)
  const rows = points.map((p) => ({
    label: p.label,
    value: p.y === null ? '—' : format(p.y),
    n: p.n,
  }))

  if (plotted.length === 0) {
    return (
      <ChartFrame
        title={title}
        caption={caption}
        rows={rows}
        height={height}
        fallback="Nothing measured yet. This fills in as you run retrievals."
      >
        <div />
      </ChartFrame>
    )
  }

  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const maxX = Math.max(1, ...points.map((p) => p.x))
  const x = (v: number) => PAD.left + (v / maxX) * innerW
  const y = (v: number) => PAD.top + innerH - (Math.min(v, yMax) / yMax) * innerH

  // The line is drawn only through solid points, and it BREAKS at every sparse or missing one.
  // That break is the whole point: it is what stops a trend line from claiming more than the data.
  const segments: SeriesPoint[][] = []
  let run: SeriesPoint[] = []
  for (const p of points) {
    if (p.y === null || p.sparse) {
      if (run.length > 1) segments.push(run)
      run = []
    } else {
      run.push(p)
    }
  }
  if (run.length > 1) segments.push(run)

  const solid = points.filter((p) => p.y !== null && !p.sparse)
  const emphasis = solid.length > 0 ? (invertGood ? solid[solid.length - 1] : solid[solid.length - 1]) : null
  const trendable = canDrawTrend(points)

  return (
    <ChartFrame title={title} caption={caption} rows={rows} height={height}>
      <svg
        className="viz-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${title}. ${rows.map((r) => `${r.label}: ${r.value}`).join('. ')}`}
      >
        {/* Gridlines: hairline, solid, recessive. Three is enough to read a value against. */}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(yMax * t)}
              y2={y(yMax * t)}
              className="viz-grid"
            />
            <text x={PAD.left - 7} y={y(yMax * t) + 3.5} className="viz-tick" textAnchor="end">
              {format(yMax * t)}
            </text>
          </g>
        ))}

        {segments.map((seg, i) => (
          <polyline
            key={i}
            className="viz-line"
            points={seg.map((p) => `${x(p.x)},${y(p.y!)}`).join(' ')}
          />
        ))}

        {points
          .filter((p) => p.y !== null)
          .map((p) => (
            <circle
              key={`${p.x}-${p.label}`}
              cx={x(p.x)}
              cy={y(p.y!)}
              r={p.sparse ? 3.5 : 4.5}
              className={p.sparse ? 'viz-dot-sparse' : 'viz-dot'}
            >
              <title>{`${p.label}: ${format(p.y!)} (n=${p.n})${p.sparse ? ' — too few to plot as a trend' : ''}`}</title>
            </circle>
          ))}

        {/* One direct label, on the most recent solid point. Never a number on every dot. */}
        {emphasis && (
          <text
            x={Math.min(x(emphasis.x) + 9, width - PAD.right)}
            y={y(emphasis.y!) - 8}
            className="viz-label"
            textAnchor={x(emphasis.x) > width * 0.7 ? 'end' : 'start'}
          >
            {format(emphasis.y!)}
          </text>
        )}
      </svg>

      {!trendable && (
        <p className="viz-note">
          Not enough yet to draw a trend — hollow points are the ones still too thin to join.
        </p>
      )}
    </ChartFrame>
  )
}

// ── Bars: magnitude across a small set of named categories ────────────────────

export interface BarDatum {
  label: string
  /** 0..1 */
  value: number | null
  n: number
  sparse?: boolean
}

export function Bars({
  data,
  title,
  caption,
  format = (v: number) => `${Math.round(v * 100)}%`,
  showN = true,
}: {
  data: BarDatum[]
  title: string
  caption?: string
  format?: (v: number) => string
  showN?: boolean
}) {
  const rows = data.map((d) => ({
    label: d.label,
    value: d.value === null ? '—' : format(d.value),
    n: d.n,
  }))

  const anyData = data.some((d) => d.value !== null)
  if (!anyData) {
    return (
      <ChartFrame title={title} caption={caption} rows={rows} height={80} fallback="Nothing logged yet.">
        <div />
      </ChartFrame>
    )
  }

  return (
    <ChartFrame title={title} caption={caption} rows={rows}>
      <div className="viz-bars" role="img" aria-label={`${title}. ${rows.map((r) => `${r.label}: ${r.value}`).join('. ')}`}>
        {data.map((d) => (
          <div className="viz-bar-row" key={d.label}>
            <div className="viz-bar-label">
              <span>{d.label}</span>
              <span className="viz-bar-value mono">
                {d.value === null ? '—' : format(d.value)}
                {showN && <span className="viz-bar-n"> n={d.n}</span>}
              </span>
            </div>
            <div className="viz-bar-track">
              <div
                className={`viz-bar-fill${d.sparse ? ' sparse' : ''}`}
                style={{ inlineSize: `${Math.max(0, Math.min(1, d.value ?? 0)) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartFrame>
  )
}

/**
 * The retention curve — recall proportion at each delay.
 *
 * This is the app's headline chart and it is deliberately shaped like the thing it measures: a
 * forgetting curve. Points that lack the observations to be trusted stay hollow and unjoined.
 */
export function RetentionCurve({
  stats,
}: {
  stats: { label: string; proportion: number | null; n: number; insufficient: boolean }[]
}) {
  const points: SeriesPoint[] = stats.map((s, i) => ({
    x: i,
    y: s.proportion,
    n: s.n,
    sparse: s.insufficient,
    label: s.label,
  }))
  return (
    <Curve
      points={points}
      title="Recall by delay"
      caption="Proportion of names produced unaided, at each delay since meeting"
      format={(v) => `${Math.round(v * 100)}%`}
      height={168}
    />
  )
}
