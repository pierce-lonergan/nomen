import { Link } from 'react-router-dom'
import { selectGate, selectSnapshot, useStore } from '../../state/store'
import {
  capabilityStatement,
  PHASE_NAMES,
  PHASE_PURPOSE,
  type Criterion,
} from '../../domain/program/gates'
import { DRILLS, drillsAvailable, nextUnlock } from '../../domain/drills/registry'
import { computeVerdict } from '../../domain/assessment/verdict'
import { calendarDaysBetween } from '../../domain/time'
import { useNow } from '../hooks'
import { Evidence, Header, Stat } from '../components'

/**
 * The year, as a specification rather than a ladder.
 *
 * Two things are load-bearing here:
 *
 * - **A locked drill is not a dimmed prize.** The old cards ran at `opacity: 0.55`, which took
 *   their text to roughly 1.6:1 — unreadable, and a lie about what a gate is. A gate is a
 *   published criterion, so a locked drill reads at `--ink-2` and carries the phase it opens at.
 *   Never reintroduce the opacity.
 * - **The capability statement is the one typographic celebration in the application.** The
 *   three-line terracotta initial fires only on a gate the user has actually met, which works out
 *   at once every 6–12 weeks. Its rarity *is* the reward — using `.capability` a second time
 *   anywhere deletes the first.
 */

/**
 * The gate criteria arrive from the domain as display strings — `82% (n=24)`, `13 points behind`,
 * `4/4`. The honesty rail wants those in three separate slots (figure, unit, n), so the split
 * happens here, in the view, rather than in `gates.ts`, where the thresholds live and display is
 * not the job. Anything that does not match falls through whole into the figure slot.
 */
function readCriterion(c: Criterion): {
  value: string
  unit?: string
  n?: number
  needs?: number
} {
  const withN = /^(.*?)\s*\(n=(\d+)\)$/.exec(c.actual)
  const body = withN ? withN[1] : c.actual
  const split = /^([\d.]+(?:%|\/\d+)?)\s+(.+)$/.exec(body)
  const needs = /n≥(\d+)/.exec(c.required)
  return {
    value: split ? split[1] : body,
    unit: split ? ` ${split[2]}` : undefined,
    n: withN ? Number(withN[2]) : undefined,
    needs: needs ? Number(needs[1]) : undefined,
  }
}

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
      <p className="dim">
        <span className="fig">{daysIn}</span> days in this phase.
      </p>

      {verdict && (
        <div className="card accent">
          <h3>{verdict.headline}</h3>
          <p className="small muted">{verdict.reasoning}</p>
          <ul className="small muted" style={{ margin: '0 0 var(--s-3)', paddingInlineStart: 'var(--s-5)' }}>
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
          <p className="muted">
            Phase 4 does not complete. Unrehearsed names decay by design, so maintenance is a
            permanent part of the practice rather than a stage you finish.
          </p>
        ) : (
          <>
            {/* The status word leads the row like a kicker, so the criterion below it keeps the
                stat grid's two honest columns: the claim on the left, the measurement on the
                right. `met` / `not yet` / `no data` is a border and a word — never a fill. */}
            {gate.criteria.map((c) => {
              const read = readCriterion(c)
              return (
                <div key={c.id} className="row-rule">
                  <div style={{ paddingBlockStart: 'var(--s-3)' }}>
                    <span className={c.met ? 'pill good' : 'pill'}>
                      {c.met ? 'met' : c.insufficient ? 'no data' : 'not yet'}
                    </span>
                  </div>
                  <Stat
                    label={c.label}
                    hint={`needs ${c.required}`}
                    value={read.value}
                    unit={read.unit}
                    n={read.n}
                    needs={read.needs}
                    insufficient={c.insufficient}
                  />
                </div>
              )
            })}
            <div className="spacer" />
            <button className="primary full" disabled={!gate.canAdvance} onClick={() => void state.advancePhase(now)}>
              {gate.canAdvance ? (
                <>
                  Advance to phase <span className="fig">{gate.nextPhase}</span>
                </>
              ) : (
                'Criteria not met yet'
              )}
            </button>
            <p className="record-note">
              Phases advance on measurements, not on the calendar — with one deliberate exception,
              the <span className="fig">45</span>-day floor in phase{' '}
              <span className="fig">1</span>, because habit automaticity takes roughly two months
              and enthusiasm is not a substitute for it.
            </p>
          </>
        )}
      </div>

      <h2>Where you actually are</h2>
      {/* The signature moment. The drop cap is earned by a met gate and by nothing else. */}
      {gate.canAdvance ? (
        <p className="capability">{capabilityStatement(snapshot)}</p>
      ) : (
        <p>{capabilityStatement(snapshot)}</p>
      )}

      <h2>Drills</h2>
      {/* Three states, not two. A drill whose phase gate has opened but which is not built gets a
          neutral pill and says so in words — a green "unlocked" badge on a drill that cannot put a
          single item in your queue is exactly the overstatement this app refuses everywhere else. */}
      {unlocked.map((d) => (
        <section key={d.id} className="row-rule" style={{ paddingBlockEnd: 'var(--s-5)', marginBlockEnd: 'var(--s-5)' }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{d.name}</h3>
            <span className={d.notBuilt ? 'pill' : 'pill good'}>
              {d.notBuilt ? 'not built yet' : 'in your queue'}
            </span>
          </div>
          <p className="muted" style={{ margin: 'var(--s-2) 0 0' }}>
            {d.purpose}
          </p>
          {d.notBuilt && <p className="record-note">{d.notBuilt}</p>}
          <Evidence>{d.mechanism}</Evidence>
        </section>
      ))}
      {/* A gate is a specification, not a dimmed prize: full contrast, and the phase that opens
          it stated in a pill. There is no opacity on this row and there must never be. */}
      {DRILLS.filter((d) => d.minPhase > phase).map((d) => (
        <section key={d.id} className="row-rule" style={{ paddingBlockEnd: 'var(--s-4)', marginBlockEnd: 'var(--s-4)' }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{d.name}</h3>
            <span className="pill">phase {d.minPhase}</span>
          </div>
          <p className="muted" style={{ margin: 'var(--s-2) 0 0' }}>
            {d.purpose}
          </p>
        </section>
      ))}
      {upcoming && (
        <p className="record-note">
          Next unlock: {upcoming.name}, at phase <span className="fig">{upcoming.minPhase}</span>.
        </p>
      )}

      <h2>The rest of the year</h2>
      {([0, 1, 2, 3, 4] as const).map((p) => (
        <div key={p} className="row-rule" style={{ paddingBlock: 'var(--s-3)' }}>
          <div className="row between">
            <span>
              Phase <span className="fig">{p}</span> — {PHASE_NAMES[p]}
            </span>
            {p === phase && <span className="pill good">here</span>}
          </div>
          <p className="dim" style={{ margin: 'var(--s-1) 0 0' }}>
            {PHASE_PURPOSE[p]}
          </p>
        </div>
      ))}

      <div className="row" style={{ marginBlockStart: 'var(--s-5)' }}>
        {/* `.btn` rather than a <button> inside the <a>: a control nested in a link is invalid
            markup, and the anchor was already doing the work. No `.full` on the pair — it would
            trip `.full + .full`'s stacking margin and knock the second one off the baseline. */}
        <Link to="/baseline" className="btn grow">
          Baseline &amp; re-tests
        </Link>
        <Link to="/tracks" className="btn grow">
          Cast &amp; place tracks
        </Link>
      </div>
      <div className="spacer" />
      <Link to="/settings" className="btn full ghost">
        Settings, privacy, and your data
      </Link>
    </>
  )
}
