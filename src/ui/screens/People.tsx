import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../state/store'
import { needsMoreLooks, varietyCoverage } from '../../domain/faceVariety'
import { formatInterval } from '../../domain/time'
import { MIN_N } from '../../domain/metrics/recall'
import { useNow } from '../hooks'
import { Avatar, Bar, Chips, Empty, Header, PersonName } from '../components'

/**
 * The roster.
 *
 * The list is rows on rules, not stacked cards — a boxed list of human beings reads as a settings
 * screen. And this is the screen where the direction's central claim gets demonstrated at length:
 * scrolling a register where **every name is the only serif on a page of grotesque**.
 */
export default function People() {
  const state = useStore()
  const now = useNow()
  const [filter, setFilter] = useState<'ACTIVE' | 'ROSTER' | 'ATTENTION'>('ACTIVE')

  const thin = needsMoreLooks(state.people, state.media)
  const coverage = varietyCoverage(state.people, state.media)
  const reencode = state.items.filter((i) => i.needsReencoding)

  const shown = state.people
    .filter((p) => p.track === 'PERSON')
    .filter((p) => {
      if (filter === 'ROSTER') return p.status === 'ROSTER'
      if (filter === 'ATTENTION') return thin.some((t) => t.id === p.id) || reencode.some((i) => i.subjectId === p.id)
      return p.status === 'ACTIVE'
    })
    .sort((a, b) => b.metAt - a.metAt)

  const total = state.people.filter((p) => p.track === 'PERSON').length

  return (
    <>
      <Header title="People" sub={`${total} in your records.`} />

      <div className="card tight">
        <div className="row between">
          <span className="small">Known from more than one occasion</span>
          <span className="mono small">
            {coverage.covered}/{coverage.total}
          </span>
        </div>
        <div className="spacer" />
        <Bar value={coverage.ratio} sufficient={coverage.total >= MIN_N} />
        <p className="dim" style={{ marginBlockStart: 'var(--s-2)' }}>
          A single photograph teaches you a photograph. Real face learning needs looks from
          different days — this is a phase-2 gate for exactly that reason.
        </p>
      </div>

      <div style={{ margin: 'var(--s-5) 0 var(--s-4)' }}>
        <Chips
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ACTIVE', label: 'In rotation' },
            { value: 'ROSTER', label: 'Roster' },
            { value: 'ATTENTION', label: 'Needs attention' },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <Empty
          title="Nobody here"
          body={
            filter === 'ROSTER'
              ? 'The roster fills when you meet more people in a day than the intake cap allows. That is a feature.'
              : 'Capture someone and they will appear here.'
          }
          action={
            <Link to="/capture" className="btn primary">
              Capture someone
            </Link>
          }
        />
      ) : (
        <div>
          {shown.map((p) => {
            const items = state.items.filter((i) => i.subjectId === p.id)
            const next = [...items].sort((a, b) => a.due - b.due)[0]
            const flagged = reencode.some((i) => i.subjectId === p.id)
            return (
              <Link
                key={p.id}
                to={`/people/${p.id}`}
                className="row row-rule"
                style={{
                  paddingBlock: 'var(--s-3)',
                  textDecoration: 'none',
                  color: 'inherit',
                  minBlockSize: 'var(--tap)',
                }}
              >
                <Avatar person={p} media={state.media} />
                <div className="grow">
                  <div style={{ fontSize: 'var(--t-lede)', lineHeight: 'var(--lh-lede)' }}>
                    <PersonName person={p} />
                  </div>
                  <div className="dim">
                    {p.context || 'no context recorded'}
                    {next && (
                      <>
                        {' · due '}
                        {next.due > now ? (
                          <>
                            in <span className="fig">{formatInterval(next.due - now)}</span>
                          </>
                        ) : (
                          'now'
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* Neutral, not amber. Eleven cautionary pills down a scroll reads as a wall of
                    alerts, and needing a better photograph is not an alarming fact about anyone.
                    The word carries the meaning; the "Needs attention" filter is the affordance. */}
                {flagged && <span className="pill">re-encode</span>}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
