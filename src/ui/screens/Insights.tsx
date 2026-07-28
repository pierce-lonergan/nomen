import { selectLatencyFit, selectSnapshot, useStore } from '../../state/store'
import { dividedAttentionGap, totRate } from '../../domain/metrics/recall'
import { adherenceByBeat, analyseConfounds, preSleepCompliance } from '../../domain/metrics/confounds'
import { latencyImprovement, successfulLatencies } from '../../domain/metrics/latency'
import { useNow } from '../hooks'
import { Bar, Evidence, Header, Stat } from '../components'

/**
 * Insights is the anti-self-deception screen.
 *
 * Everything here shows its `n`, and anything below the threshold says "not enough data" instead
 * of drawing a line. Subjective memory improvement is known to overstate the real thing, so the
 * job of this screen is to be less flattering than the user's own impression.
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

  return (
    <>
      <Header
        title="Insights"
        sub="Measurements, with their sample sizes. Where the data is too thin to support a claim, this page says so instead of drawing a line."
      />

      <h2>Recall by delay</h2>
      <div className="card">
        {snapshot.recall.map((r) => (
          <Stat
            key={r.bucket}
            label={r.label}
            value={r.proportion === null ? '—' : `${Math.round(r.proportion * 100)}%`}
            n={r.n}
            insufficient={r.insufficient}
          />
        ))}
        <Evidence>
          This mirrors the paradigm the strongest name-learning evidence comes from. A
          tip-of-the-tongue counts as a failure of free recall here — counting it as a partial
          success would flatter the exact number this whole app exists to move.
        </Evidence>
      </div>

      <h2>Fluency</h2>
      <div className="card">
        <Stat
          label="Median retrieval time, recently"
          value={improvement ? `${(improvement.recentMs / 1000).toFixed(1)}s` : '—'}
          n={latencies.length}
          insufficient={!improvement}
        />
        <Stat
          label="Faster than when you started"
          value={improvement ? `${Math.round(improvement.percentFaster)}%` : '—'}
          insufficient={!improvement}
        />
        <Stat
          label="Estimated floor"
          value={fit && !fit.weak ? `${(fit.asymptoteMs / 1000).toFixed(1)}s` : '—'}
          hint={fit ? `power-law fit R²=${fit.r2.toFixed(2)}` : undefined}
          n={fit?.n}
          insufficient={!fit || fit.weak}
        />
        {fit?.weak && (
          <p className="small muted" style={{ marginTop: 10 }}>
            The practice curve doesn’t fit your times well enough to read a floor off it yet. Human
            retrieval times are noisy, and a badly-fitting curve still produces confident-looking
            numbers — so this one stays hidden until it earns its place.
          </p>
        )}
        {fit && !fit.weak && fit.inTail && (
          <p className="small muted" style={{ marginTop: 10 }}>
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
          value={tot.rate === null ? '—' : `${Math.round(tot.rate * 100)}%`}
          n={tot.n}
          insufficient={tot.n < 10}
        />
        <Evidence>
          Names are the single largest category of tip-of-the-tongue targets, and the reason is
          structural: they are the lowest-frequency, least-rehearsed items you hold, so the
          connections that carry priming to the phonological form are the weakest ones you have.
          Spaced retrieval is the direct antidote.
        </Evidence>
      </div>

      <h2>Protocol adherence, per beat</h2>
      <div className="card">
        {beats.n === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            No introductions logged in the last fortnight, so there is nothing to report here.
          </p>
        ) : (
          <>
            {(
              [
                ['heard', 'HEAR — the name arrived'],
                ['said', 'SAY — said it back aloud'],
                ['looked', 'LOOK — at the face while saying it'],
                ['hooked', 'HOOK — one association'],
              ] as const
            ).map(([key, label]) => {
              const rate = beats.rates[key] ?? 0
              return (
                <div key={key} style={{ padding: '8px 0' }}>
                  <div className="row between">
                    <span className="small">{label}</span>
                    <span className="mono small">{Math.round(rate * 100)}%</span>
                  </div>
                  <div className="spacer" />
                  <Bar value={rate} />
                </div>
              )
            })}
            <div className="dim" style={{ marginTop: 8 }}>
              Across {beats.n} introduction{beats.n === 1 ? '' : 's'} in the last 14 days
              {beats.n < 10 ? ' — too few to read much into yet.' : '.'} The beat you drop under
              pressure is the one to work on. Most people drop LOOK first, which is attention
              turning inward at exactly the wrong moment.
            </div>
          </>
        )}
      </div>

      {divided.n > 0 && (
        <>
          <h2>Lab versus life</h2>
          <div className="card">
            <Stat
              label="Undistracted"
              value={divided.focused === null ? '—' : `${Math.round(divided.focused * 100)}%`}
            />
            <Stat
              label="With a second task running"
              value={divided.divided === null ? '—' : `${Math.round(divided.divided * 100)}%`}
              n={divided.n}
              insufficient={divided.n < 10}
            />
            <Stat
              label="Gap"
              value={divided.gapPoints === null ? '—' : `${Math.round(divided.gapPoints)} points`}
              insufficient={divided.gapPoints === null}
              n={divided.n}
              hint="the phase-3 gate wants this within 20 points"
            />
          </div>
        </>
      )}

      <h2>What else is going on</h2>
      {findings.map((f) => (
        <div key={f.factor} className="card tight">
          <div className="row between">
            <strong className="small">{f.factor.toLowerCase()}</strong>
            {!f.insufficient && f.gapPoints !== null && (
              <span className={`pill ${f.gapPoints >= 20 ? 'warn' : ''}`}>{Math.round(f.gapPoints)} pt spread</span>
            )}
          </div>
          <div className="dim" style={{ marginTop: 4 }}>
            {f.splits
              .map((s) => `${s.label}: ${s.rate === null ? '—' : `${Math.round(s.rate * 100)}%`} (n=${s.n})`)
              .join(' · ')}
          </div>
          {f.interpretation ? (
            <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
              {f.interpretation}
            </p>
          ) : (
            <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Not enough observations in each group to say anything responsibly yet.
            </p>
          )}
        </div>
      ))}

      <h2>Your own experiments</h2>
      <div className="card">
        <Stat
          label="Queue completion on pre-sleep-review days"
          value={preSleep.withReview === null ? '—' : `${Math.round(preSleep.withReview * 100)}%`}
          insufficient={preSleep.n < 10}
          n={preSleep.n}
        />
        <Stat
          label="…on days without it"
          value={preSleep.withoutReview === null ? '—' : `${Math.round(preSleep.withoutReview * 100)}%`}
          insufficient={preSleep.n < 10}
        />
        <Evidence>
          It would be embarrassing for an evidence-led app to run on a faith-based engagement model,
          so the loop’s own assumptions are testable on your data. If the pre-sleep slot turns out not
          to be your best anchor, move it.
        </Evidence>
      </div>
    </>
  )
}
