import { Link, useNavigate } from 'react-router-dom'
import { useStore, selectPlan, selectStreak } from '../../state/store'
import { streakCopy } from '../../domain/engagement/streak'
import { dayClose } from '../../domain/engagement/rewards'
import { dayKey, formatInterval } from '../../domain/time'
import { useNow } from '../hooks'
import { Avatar, Empty, Evidence, Header } from '../components'

/**
 * The day loop, in one screen.
 *
 * Order is deliberate: what to do now → the field mission → the things at risk → the roster
 * waiting to come in. The streak sits at the bottom, not the top, because it is the least
 * important true thing on the page and putting it first would make the app about the streak.
 */
export default function Today() {
  const state = useStore()
  const navigate = useNavigate()
  const now = useNow()
  const plan = selectPlan(state, now)
  const streak = selectStreak(state, now)
  const copy = streakCopy(streak)
  const today = state.days.find((d) => d.day === dayKey(now))

  const queueSize = plan.queue.queue.length
  const held = state.attempts.filter(
    (a) => dayKey(a.at) === plan.day && (a.grade === 'GOT' || a.grade === 'INSTANT'),
  ).length
  const attempted = state.attempts.filter((a) => dayKey(a.at) === plan.day).length

  return (
    <>
      <Header
        title={greeting(plan.timeOfDay)}
        sub={plan.focus}
      />

      {plan.suggestAmnesty ? (
        <div className="card accent">
          <h3>Let’s not do this as a wall</h3>
          <p className="small muted">
            {plan.queue.queue.length + plan.queue.deferred.length} retrievals have piled up. Clearing a
            backlog in one sitting is the single most reliable way to stop using a tool like this.
            Spread them across the next fortnight instead — nothing is lost.
          </p>
          <div className="row">
            <button className="primary grow" onClick={() => void state.runAmnesty(14, now)}>
              Spread over 14 days
            </button>
            <button onClick={() => navigate('/session')}>Just start</button>
          </div>
        </div>
      ) : queueSize > 0 ? (
        <div className="card accent">
          <h3>
            {queueSize} retrieval{queueSize === 1 ? '' : 's'} ready
          </h3>
          <p className="small muted">
            {plan.timeOfDay === 'PRE_SLEEP'
              ? 'This is the pre-sleep slot. What you retrieve now gets consolidated overnight.'
              : 'Test before you peek — the answer is never on screen with the prompt.'}
          </p>
          <button className="primary full" onClick={() => navigate('/session')}>
            Start · about {Math.max(1, Math.round(queueSize * 0.25))} min
          </button>
        </div>
      ) : (
        <div className="card">
          <h3>Nothing due</h3>
          <p className="small muted">
            A quiet day is a normal day. The practice is the four beats at the next introduction —
            that part doesn’t live in the app.
          </p>
          <Link to="/capture">
            <button className="full">Someone new →</button>
          </Link>
        </div>
      )}

      <h2>Today’s mission</h2>
      <div className="card">
        <div className="row between">
          <div className="grow">
            <p style={{ marginBottom: 6 }}>{plan.mission.text}</p>
            <div className="dim">
              {plan.mission.progress}/{plan.mission.target}
              {plan.mission.completed ? ' · done' : ''}
            </div>
          </div>
        </div>
        <div className="spacer" />
        <button className="full" disabled={plan.mission.completed} onClick={() => void state.logNameUsedAloud(now)}>
          {plan.mission.completed ? 'Completed' : 'I did it once'}
        </button>
        <Evidence>
          Missions are how the app reaches the place where the payoff actually happens. Saying a name
          aloud recruits the production effect, and using it in conversation is a retrieval you
          didn’t have to schedule.
        </Evidence>
      </div>

      {plan.atRisk.length > 0 && (
        <>
          <h2>Slipping</h2>
          <div className="card">
            <p className="small muted">
              Overdue by more than half the interval they were holding. Unrehearsed names decay by
              design — this list is the honest consequence, not a nag.
            </p>
            {plan.atRisk.slice(0, 6).map((item) => {
              const person = state.people.find((p) => p.id === item.subjectId)
              if (!person) return null
              return (
                <div key={item.id} className="row" style={{ padding: '8px 0' }}>
                  <Avatar person={person} media={state.media} />
                  <div className="grow">
                    <div>{person.displayName}</div>
                    <div className="dim">overdue by {formatInterval(now - item.due)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {plan.promotable.length > 0 && (
        <>
          <h2>Waiting to come in</h2>
          <div className="card">
            <p className="small muted">
              You met more people than a day’s intake allows, so these are parked with their records
              intact. Capping intake is what stops a good week becoming an unusable queue.
            </p>
            {plan.promotable.map((p) => (
              <div key={p.id} className="row" style={{ padding: '6px 0' }}>
                <Avatar person={p} media={state.media} />
                <div className="grow">{p.displayName}</div>
                <span className="pill">{p.likelihoodOfMeetingAgain.toLowerCase()}</span>
              </div>
            ))}
            <div className="spacer" />
            <button className="full" onClick={() => void state.promote(plan.promotable)}>
              Bring {plan.promotable.length} into rotation
            </button>
          </div>
        </>
      )}

      <h2>Where you are</h2>
      <div className="card tight">
        <div className="row between">
          <div>
            <h3 style={{ margin: 0 }}>{copy.headline}</h3>
            <div className="dim">{copy.sub}</div>
          </div>
        </div>
        <hr />
        <div className="small muted">{dayClose({
          captured: today?.newPeople ?? 0,
          usedAloud: today?.namesUsedAloud ?? 0,
          retrievalsHeld: held,
          retrievalsAttempted: attempted,
        })}</div>
        <div className="spacer" />
        <div className="row">
          <button className="grow ghost small" onClick={() => void state.markRestDay(now, !today?.restDay)}>
            {today?.restDay ? 'Cancel rest day' : 'Take a rest day'}
          </button>
          <Link to="/journal" className="grow">
            <button className="full ghost small">It worked today →</button>
          </Link>
        </div>
      </div>

      {state.people.length === 0 && (
        <Empty
          title="Nothing here yet"
          body="Start with the baseline so the app knows which stage of the problem is actually yours — it changes what you train first."
          action={
            <Link to="/baseline">
              <button className="primary">Run the baseline</button>
            </Link>
          }
        />
      )}
    </>
  )
}

function greeting(tod: 'MORNING' | 'DAY' | 'PRE_SLEEP'): string {
  if (tod === 'MORNING') return 'This morning'
  if (tod === 'PRE_SLEEP') return 'Before bed'
  return 'Today'
}
