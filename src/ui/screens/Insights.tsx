import { selectLatencyFit, selectSnapshot, useStore } from '../../state/store'
import { dividedAttentionGap, MIN_N, totRate } from '../../domain/metrics/recall'
import { adherenceByBeat, analyseConfounds, preSleepCompliance } from '../../domain/metrics/confounds'
import { latencyImprovement, successfulLatencies } from '../../domain/metrics/latency'
import { latencyCurve } from '../../domain/metrics/series'
import { useNow } from '../hooks'
import { Bars, Curve, RetentionCurve, type BarDatum } from '../charts'
import { Evidence, Header, Stat } from '../components'

/**
 * Insights is the anti-self-deception screen.
 *
 * Its job is to be *less* flattering than the user's own impression, because subjective memory
 * gains reliably overstate real ones. Everything carries its `n`; anything below the threshold
 * sets a figure dash in the number's slot rather than a number, and the charts leave those points
 * hollow and unjoined instead of drawing a line through them.
 */
export default function Insights() {
  const state = useStore()
  const now = useNow(60_000)
  const snapshot = selectSnapshot(state, now)
  const fit = selectLatencyFit(state)
  const latencies = successfulLatencies(state.attempts)
  const improvement = latencyImprovement(latencies)
  const tot = totRate(state.attempts)
  const divided = dividedAttentionGap(state.attempts)
  const beats = adherenceByBeat(state.people, now - 14 * 24 * 60 * 60 * 1000)
  const findings = analyseConfounds(state.attempts, state.people)
  const preSleep = preSleepCompliance(state.days)

  const beatData: BarDatum[] = (
    [
      ['heard', 'HEAR — the name arrived'],
      ['said', 'SAY — said it back aloud'],
      ['looked', 'LOOK — at the face while saying it'],
      ['hooked', 'HOOK — one association'],
    ] as const
  ).map(([key, label]) => ({
    label,
    value: beats.rates[key],
    n: beats.n,
    sparse: beats.n < MIN_N,
  }))

  return (
    <>
      <Header
        title="Insights"
        sub="Measurements, with their sample sizes. Where the data is too thin to support a claim, this page sets a dash rather than a number."
      />

      <h2>Recall by delay</h2>
      <RetentionCurve stats={snapshot.recall} />
      <div className="card">
        {snapshot.recall.map((r) => (
          <Stat
            key={r.bucket}
            label={r.label}
            value={r.proportion === null ? '—' : `${Math.round(r.proportion * 100)}`}
            unit="%"
            n={r.n}
            needs={MIN_N}
            insufficient={r.insufficient}
          />
        ))}
        <p className="record-note">
          A tip-of-the-tongue counts as a failure of free recall here. Counting it as a partial
          success would flatter the exact number this whole app exists to move.
        </p>
      </div>

      <h2>Fluency</h2>
      <Curve
        points={latencyCurve(state.attempts)}
        title="Retrieval time over practice"
        caption="Median seconds per block of retrievals, binned by ordinal — the power law is a function of repetitions, not of elapsed time"
        format={(v) => `${(v / 1000).toFixed(1)}s`}
        yMax={Math.max(1000, ...latencyCurve(state.attempts).map((p) => p.y ?? 0))}
        invertGood
      />
      <div className="card">
        <Stat
          label="Median retrieval time, recently"
          value={improvement ? `${(improvement.recentMs / 1000).toFixed(1)}` : '—'}
          unit="s"
          n={latencies.length}
          needs={40}
          insufficient={!improvement}
        />
        <Stat
          label="Faster than when you started"
          value={improvement ? `${Math.round(improvement.percentFaster)}` : '—'}
          unit="%"
          insufficient={!improvement}
        />
        <Stat
          label="Estimated floor"
          value={fit && !fit.weak ? `${(fit.asymptoteMs / 1000).toFixed(1)}` : '—'}
          unit="s"
          hint={fit ? `power-law fit, R² ${fit.r2.toFixed(2)}` : undefined}
          n={fit?.n}
          insufficient={!fit || fit.weak}
        />
        {fit?.weak && (
          <p className="record-note">
            The practice curve doesn’t fit your times well enough to read a floor off it yet. Human
            retrieval times are noisy, and a badly-fitting curve still produces confident-looking
            numbers — so this one stays hidden until it earns its place.
          </p>
        )}
        {fit && !fit.weak && fit.inTail && (
          <p className="record-note">
            Your latency has flattened. That is the normal power-law tail, not a plateau you have
            failed to break — retrieval never becomes fully automatic, because every new person is a
            new binding. Fast and fluent is the achievable endpoint.
          </p>
        )}
      </div>

      <h2>Tip-of-the-tongue</h2>
      <div className="card">
        <Stat
          label="Attempts that needed a cue"
          value={tot.rate === null ? '—' : `${Math.round(tot.rate * 100)}`}
          unit="%"
          n={tot.n}
          needs={MIN_N}
          insufficient={tot.n < MIN_N}
        />
        <Evidence>
          Names are the single largest category of tip-of-the-tongue targets, and the reason is
          structural: they are the lowest-frequency, least-rehearsed items you hold, so the
          connections that carry priming to the phonological form are the weakest ones you have.
          Spaced retrieval is the direct antidote.
        </Evidence>
      </div>

      <h2>Protocol adherence</h2>
      <Bars
        data={beatData}
        title="Protocol adherence, per beat"
        caption={`Share of introductions in the last 14 days where each beat was logged${beats.n < MIN_N ? ' — too few to read much into yet' : ''}`}
      />
      <p className="record-note">
        The beat you drop under pressure is the one to work on. Most people drop LOOK first, which
        is attention turning inward at exactly the wrong moment.
      </p>

      {divided.n > 0 && (
        <>
          <h2>Lab versus life</h2>
          <div className="card">
            <Stat
              label="Undistracted"
              value={divided.focused === null ? '—' : `${Math.round(divided.focused * 100)}`}
              unit="%"
              insufficient={divided.focused === null}
            />
            <Stat
              label="With a second task running"
              value={divided.divided === null ? '—' : `${Math.round(divided.divided * 100)}`}
              unit="%"
              n={divided.n}
              needs={MIN_N}
              insufficient={divided.n < MIN_N}
            />
            <Stat
              label="Gap"
              value={divided.gapPoints === null ? '—' : `${Math.round(divided.gapPoints)}`}
              unit="pts"
              hint="the phase-3 gate wants this within 20 points"
              n={divided.n}
              needs={MIN_N}
              insufficient={divided.gapPoints === null}
            />
          </div>
        </>
      )}

      <h2>What else is going on</h2>
      {/* Ruled registers, not cards. Each chart carries its own panel; wrapping it in a second
          box and repeating the factor name above it was saying everything twice. */}
      {findings.map((f) => (
        <section key={f.factor} style={{ marginBlockEnd: 'var(--s-6)' }}>
          <Bars
            data={f.splits.map((s) => ({
              label: s.label,
              value: s.rate,
              n: s.n,
              sparse: s.n < MIN_N,
            }))}
            title={f.factor.toLowerCase()}
            caption={
              f.insufficient || f.gapPoints === null
                ? 'Recall by the conditions at the moment you met them'
                : `Recall by the conditions at the moment you met them — a ${Math.round(f.gapPoints)} point spread`
            }
          />
          <p className={f.interpretation ? 'small' : 'record-note'}>
            {f.interpretation ??
              'Not enough observations in each group to say anything responsibly yet.'}
          </p>
        </section>
      ))}

      <h2>Your own experiments</h2>
      <div className="card">
        <Stat
          label="Queue completion on pre-sleep-review days"
          value={preSleep.withReview === null ? '—' : `${Math.round(preSleep.withReview * 100)}`}
          unit="%"
          n={preSleep.n}
          needs={MIN_N}
          insufficient={preSleep.n < MIN_N || preSleep.withReview === null}
        />
        <Stat
          label="…on days without it"
          value={preSleep.withoutReview === null ? '—' : `${Math.round(preSleep.withoutReview * 100)}`}
          unit="%"
          n={preSleep.n}
          needs={MIN_N}
          insufficient={preSleep.n < MIN_N || preSleep.withoutReview === null}
        />
        <Evidence>
          It would be embarrassing for an evidence-led app to run on a faith-based engagement model,
          so the loop’s own assumptions are testable on your data. If the pre-sleep slot turns out
          not to be your best anchor, move it.
        </Evidence>
      </div>
    </>
  )
}
