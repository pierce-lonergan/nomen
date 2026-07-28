import { Link } from 'react-router-dom'
import { selectGate, selectSnapshot, useStore } from '../../state/store'
import { capabilityStatement, PHASE_NAMES, PHASE_PURPOSE } from '../../domain/program/gates'
import { DRILLS, drillsAvailable, nextUnlock } from '../../domain/drills/registry'
import { computeVerdict } from '../../domain/assessment/verdict'
import { calendarDaysBetween } from '../../domain/time'
import { useNow } from '../hooks'
import { Evidence, Header } from '../components'

export default function Program() {
  const state = useStore()
  const now = useNow(60_000)
  const snapshot = selectSnapshot(state, now)
  const gate = selectGate(state, now)
  const phase = state.settings.phase
  const daysIn = state.settings.phaseEnteredAt ? calendarDaysBetween(state.settings.phaseEnteredAt, now) : 0
  const unlocked = drillsAvailable(phase)
  const upcoming = nextUnlock(phase)
  const verdict = state.assessments.length > 0 ? computeVerdict(state.assessments) : null

  return (
    <>
      <Header title={`Phase ${phase} — ${PHASE_NAMES[phase]}`} sub={PHASE_PURPOSE[phase]} />
      <p className="dim">{daysIn} days in this phase.</p>

      {verdict && (
        <div className="card accent">
          <h3>{verdict.headline}</h3>
          <p className="small muted">{verdict.reasoning}</p>
          <ul className="small" style={{ paddingLeft: 18, margin: '8px 0' }}>
            {verdict.emphasis.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {verdict.flags.map((f) => (
            <p key={f} className="small muted">
              {f}
            </p>
          ))}
        </div>
      )}

      <h2>Gate to the next phase</h2>
      <div className="card">
        {gate.criteria.length === 0 ? (
          <p className="small muted">
            Phase 4 does not complete. Unrehearsed names decay by design, so maintenance is a
            permanent part of the practice rather than a stage you finish.
          </p>
        ) : (
          <>
            {gate.criteria.map((c) => (
              <div key={c.id} className="stat">
                <div>
                  <div className="small">{c.label}</div>
                  <div className="dim">needs {c.required}</div>
                </div>
                <div className={`stat-value${c.insufficient ? ' insufficient' : ''}`}>
                  <span className={c.met ? 'pill good' : 'pill'}>{c.met ? 'met' : c.insufficient ? 'no data' : 'not yet'}</span>
                  <div className="dim">{c.actual}</div>
                </div>
              </div>
            ))}
            <div className="spacer" />
            <button className="primary full" disabled={!gate.canAdvance} onClick={() => void state.advancePhase(now)}>
              {gate.canAdvance ? `Advance to phase ${gate.nextPhase}` : 'Criteria not met yet'}
            </button>
            <div className="dim" style={{ marginTop: 8 }}>
              Phases advance on measurements, not on the calendar — with one deliberate exception, the
              45-day floor in phase 1, because habit automaticity takes roughly two months and
              enthusiasm is not a substitute for it.
            </div>
          </>
        )}
      </div>

      <h2>Where you actually are</h2>
      <div className="card">
        <p className="small">{capabilityStatement(snapshot)}</p>
      </div>

      <h2>Drills</h2>
      {unlocked.map((d) => (
        <div key={d.id} className="card tight">
          <div className="row between">
            <strong>{d.name}</strong>
            <span className="pill good">unlocked</span>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {d.purpose}
          </div>
          <Evidence>{d.mechanism}</Evidence>
        </div>
      ))}
      {DRILLS.filter((d) => d.minPhase > phase).map((d) => (
        <div key={d.id} className="card tight" style={{ opacity: 0.55 }}>
          <div className="row between">
            <strong>{d.name}</strong>
            <span className="pill">phase {d.minPhase}</span>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {d.purpose}
          </div>
        </div>
      ))}
      {upcoming && (
        <p className="dim center">
          Next unlock: {upcoming.name}, at phase {upcoming.minPhase}.
        </p>
      )}

      <h2>The rest of the year</h2>
      <div className="card">
        {([0, 1, 2, 3, 4] as const).map((p) => (
          <div key={p} className="stat">
            <div>
              <div className={p === phase ? '' : 'muted'}>
                Phase {p} — {PHASE_NAMES[p]}
              </div>
              <div className="dim">{PHASE_PURPOSE[p]}</div>
            </div>
            {p === phase && <span className="pill good">here</span>}
          </div>
        ))}
      </div>

      <div className="row">
        <Link to="/baseline" className="grow">
          <button className="full">Baseline & re-tests</button>
        </Link>
        <Link to="/tracks" className="grow">
          <button className="full">Cast & place tracks</button>
        </Link>
      </div>
      <div className="spacer" />
      <Link to="/settings">
        <button className="full ghost">Settings, privacy, and your data</button>
      </Link>
    </>
  )
}
