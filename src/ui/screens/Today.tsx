import { Link, useNavigate } from 'react-router-dom'
import { useStore, selectPlan, selectStreak } from '../../state/store'
import { streakCopy } from '../../domain/engagement/streak'
import { dayClose } from '../../domain/engagement/rewards'
import { dayKey, formatInterval } from '../../domain/time'
import { useNow } from '../hooks'
import { Avatar, Empty, Evidence, Header, PersonName, Stat } from '../components'
import { IconWaning } from '../icons'

/**
 * The day loop, in one screen.
 *
 * Order is deliberate: what to do now → the field mission → the things at risk → the roster
 * waiting to come in. The streak sits at the bottom, not the top, because it is the least
 * important true thing on the page and putting it first would make the app about the streak.
 *
 * Only three things here are cards, because only three are genuinely separate objects. The
 * at-risk list and the roster are ruled registers on the page — a boxed list of people reads as
 * a settings screen, and these are human beings.
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
      <Header title={greeting(plan.timeOfDay)} sub={plan.focus} />

      {plan.suggestAmnesty ? (
        <div className="card accent">
          <h3>Let’s not do this as a wall</h3>
          <p className="muted">
            <span className="fig">{plan.queue.queue.length + plan.queue.deferred.length}</span>{' '}
            retrievals have piled up. Clearing a backlog in one sitting is the single most reliable
            way to stop using a tool like this. Spread them across the next fortnight instead —
            nothing is lost.
          </p>
          <button className="primary full btn--lg" onClick={() => void state.runAmnesty(14, now)}>
            Spread over 14 days
          </button>
          <button className="full ghost" onClick={() => navigate('/session')}>
            Just start
          </button>
        </div>
      ) : queueSize > 0 ? (
        <div className="card accent">
          <h3>
            <span className="fig">{queueSize}</span> retrieval{queueSize === 1 ? '' : 's'} ready
          </h3>
          <p className="muted">
            {plan.timeOfDay === 'PRE_SLEEP'
              ? 'This is the pre-sleep slot. What you retrieve now gets consolidated overnight.'
              : 'Test before you peek — the answer is never on screen with the prompt.'}
          </p>
          <button className="primary full btn--lg" onClick={() => navigate('/session')}>
            Start · about <span className="fig">{Math.max(1, Math.round(queueSize * 0.25))}</span> min
          </button>
        </div>
      ) : (
        <div className="card">
          <h3>Nothing due</h3>
          <p className="muted">
            A quiet day is a normal day. The practice is the four beats at the next introduction —
            that part doesn’t live in the app.
          </p>
          <Link to="/capture">
            <button className="full">Someone new</button>
          </Link>
        </div>
      )}

      <h2>Today’s mission</h2>
      <div className="card">
        <p>{plan.mission.text}</p>
        <p className="dim">
          <span className="fig">
            {plan.mission.progress}/{plan.mission.target}
          </span>
          {plan.mission.completed ? ' · done' : ''}
        </p>
        <button
          className="full"
          disabled={plan.mission.completed}
          onClick={() => void state.logNameUsedAloud(now)}
        >
          {plan.mission.completed ? 'Completed' : 'I did it once'}
        </button>
        <Evidence>
          Missions are how the app reaches the place where the payoff actually happens. Saying a
          name aloud recruits the production effect, and using it in conversation is a retrieval you
          didn’t have to schedule.
        </Evidence>
      </div>

      {plan.atRisk.length > 0 && (
        <>
          <h2>Slipping</h2>
          <p className="record-note">
            Overdue by more than half the interval they were holding. Unrehearsed names decay by
            design — this list is the honest consequence, not a nag.
          </p>
          <div>
            {plan.atRisk.slice(0, 6).map((item) => {
              const person = state.people.find((p) => p.id === item.subjectId)
              if (!person) return null
              return (
                <div key={item.id} className="row row-rule" style={{ paddingBlock: 'var(--s-3)' }}>
                  <span className="dim" style={{ display: 'flex' }} aria-hidden>
                    <IconWaning />
                  </span>
                  <Avatar person={person} media={state.media} />
                  <div className="grow">
                    {/* The name is the only serif on the screen. */}
                    <div style={{ fontSize: 'var(--t-lede)', lineHeight: 'var(--lh-lede)' }}>
                      <PersonName person={person} />
                    </div>
                    {/* The interval does not escalate in colour as it grows. A name three weeks
                        late looks exactly like a name three days late, because the honest content
                        of both is a number. */}
                    <div className="dim">
                      overdue by <span className="fig">{formatInterval(now - item.due)}</span>
                    </div>
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
          <p className="record-note">
            You met more people than a day’s intake allows, so these are parked with their records
            intact. Capping intake is what stops a good week becoming an unusable queue.
          </p>
          <div>
            {plan.promotable.map((p) => (
              <div key={p.id} className="row row-rule" style={{ paddingBlock: 'var(--s-3)' }}>
                <Avatar person={p} media={state.media} />
                <div className="grow" style={{ fontSize: 'var(--t-lede)', lineHeight: 'var(--lh-lede)' }}>
                  <PersonName person={p} />
                </div>
                <span className="pill">{p.likelihoodOfMeetingAgain.toLowerCase()}</span>
              </div>
            ))}
          </div>
          <button className="full" onClick={() => void state.promote(plan.promotable)}>
            Bring <span className="fig">{plan.promotable.length}</span> into rotation
          </button>
        </>
      )}

      <h2>Where you are</h2>

      {/*
        The signature moment of this screen. dayClose() returns the true fact that replaces the
        dopamine hit — "3 names captured, 2 used aloud, 6/8 retrievals held" — and it was
        previously set in the app's least legible style. It gets a spot rule and lede size, and
        nothing else shares the block.
      */}
      <div className="reward">
        <span className="reward__kicker">today</span>
        <p className="reward__headline">
          {dayClose({
            captured: today?.newPeople ?? 0,
            usedAloud: today?.namesUsedAloud ?? 0,
            retrievalsHeld: held,
            retrievalsAttempted: attempted,
          })}
        </p>
      </div>

      <div className="card">
        {/*
          The type-size law, expressed as arithmetic rather than discipline: the streak renders at
          lede size and the lifetime retrieval count at figure size directly beneath it, so the
          number that resets is literally the smaller number on the screen.
        */}
        <Stat label={copy.headline} value={copy.sub} variant="streak" />
        <Stat label="Retrievals, lifetime" value={streak.lifetimeRetrievals.toLocaleString()} />
        <div className="row" style={{ marginBlockStart: 'var(--s-4)' }}>
          <button className="grow ghost" onClick={() => void state.markRestDay(now, !today?.restDay)}>
            {today?.restDay ? 'Cancel rest day' : 'Take a rest day'}
          </button>
          <Link to="/journal" className="grow">
            <button className="full ghost">It worked today</button>
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
