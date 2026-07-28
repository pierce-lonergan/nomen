import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../state/store'
import { needsMoreLooks, varietyCoverage } from '../../domain/faceVariety'
import { formatInterval } from '../../domain/time'
import { useNow } from '../hooks'
import { Avatar, Bar, Empty, Header } from '../components'

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

  return (
    <>
      <Header title="People" sub={`${state.people.filter((p) => p.track === 'PERSON').length} in your records`} />

      <div className="card tight">
        <div className="row between">
          <span className="small">Known from more than one occasion</span>
          <span className="mono">
            {coverage.covered}/{coverage.total}
          </span>
        </div>
        <div className="spacer" />
        <Bar value={coverage.ratio} />
        <div className="dim" style={{ marginTop: 6 }}>
          A single photo teaches you a photograph. Real face learning needs looks from different
          days — this is a phase-2 gate for exactly that reason.
        </div>
      </div>

      <div className="chips" style={{ margin: '14px 0' }}>
        {(
          [
            ['ACTIVE', 'In rotation'],
            ['ROSTER', 'Roster'],
            ['ATTENTION', 'Needs attention'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} className={`chip${filter === value ? ' on' : ''}`} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
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
            <Link to="/capture">
              <button className="primary">Capture someone</button>
            </Link>
          }
        />
      ) : (
        shown.map((p) => {
          const items = state.items.filter((i) => i.subjectId === p.id)
          const next = items.sort((a, b) => a.due - b.due)[0]
          const flagged = reencode.some((i) => i.subjectId === p.id)
          return (
            <Link key={p.id} to={`/people/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card tight">
                <div className="row">
                  <Avatar person={p} media={state.media} />
                  <div className="grow">
                    <div>{p.displayName}</div>
                    <div className="dim">
                      {p.context || 'no context recorded'}
                      {next ? ` · due in ${next.due > now ? formatInterval(next.due - now) : 'now'}` : ''}
                    </div>
                  </div>
                  {flagged && <span className="pill warn">re-encode</span>}
                </div>
              </div>
            </Link>
          )
        })
      )}
    </>
  )
}
