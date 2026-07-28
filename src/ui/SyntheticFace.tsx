import type { FaceParams } from '../lib/stimuli'

/** A procedurally drawn face for the assessment battery. Deterministic from its parameters. */
export function SyntheticFace({ params, size = 120 }: { params: FaceParams; size?: number }) {
  const s = 100
  const skin = `hsl(${params.hue}, 34%, 68%)`
  const shadow = `hsl(${params.hue}, 30%, 54%)`
  const hair = `hsl(${params.hue - 12}, 28%, 24%)`
  const cx = s / 2
  const eyeY = s * 0.44
  const eyeDx = s * params.eyeGap
  const eyeR = s * params.eyeSize

  return (
    <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} role="img" aria-label="face">
      <rect width={s} height={s} rx="10" fill="#241f1b" />
      <ellipse cx={cx} cy={s * 0.52} rx={s * 0.3 * params.jaw} ry={s * 0.36} fill={skin} />
      <path
        d={`M ${cx - s * 0.3 * params.jaw} ${s * params.hairline + s * 0.2}
            Q ${cx} ${s * params.hairline - s * 0.02} ${cx + s * 0.3 * params.jaw} ${s * params.hairline + s * 0.2}
            L ${cx + s * 0.3 * params.jaw} ${s * params.hairline + s * 0.06}
            Q ${cx} ${s * params.hairline - s * 0.12} ${cx - s * 0.3 * params.jaw} ${s * params.hairline + s * 0.06} Z`}
        fill={hair}
      />
      {[-1, 1].map((side) => (
        <g key={side}>
          <ellipse cx={cx + side * eyeDx} cy={eyeY} rx={eyeR * 1.5} ry={eyeR} fill="#fff" />
          <circle cx={cx + side * eyeDx} cy={eyeY} r={eyeR * 0.6} fill="#2b2119" />
          <line
            x1={cx + side * eyeDx - eyeR * 1.6}
            y1={eyeY - eyeR * 2 + (side * params.browAngle) / 12}
            x2={cx + side * eyeDx + eyeR * 1.6}
            y2={eyeY - eyeR * 2 - (side * params.browAngle) / 12}
            stroke={hair}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </g>
      ))}
      <path
        d={`M ${cx} ${eyeY + s * 0.03} L ${cx - s * 0.035} ${eyeY + s * params.noseLength} L ${cx + s * 0.02} ${eyeY + s * params.noseLength}`}
        fill="none"
        stroke={shadow}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d={`M ${cx - s * params.mouthWidth} ${s * 0.72} Q ${cx} ${s * 0.77} ${cx + s * params.mouthWidth} ${s * 0.72}`}
        fill="none"
        stroke="#7d4a44"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </svg>
  )
}
