import { useState } from 'react'
import { useStore } from '../../state/store'
import type { Moment } from '../../domain/types'
import { Empty, Evidence, Header } from '../components'

/**
 * The Moment Journal.
 *
 * The actual reward for this practice happens off-app: someone's face when you greet them by name
 * three weeks after meeting them once. The app cannot see that, so it asks.
 *
 * This is the most important screen at month nine, when the novelty is gone and the queue is a
 * chore. It is the evidence file, in the user's own words, that the year is paying for itself —
 * and it is the one reward in the app that is genuinely about relatedness rather than competence.
 */
export default function Journal() {
  const state = useStore()
  const [text, setText] = useState('')
  const [feeling, setFeeling] = useState<Moment['feeling']>('GOOD')
  const [subjectId, setSubjectId] = useState<string>('')

  const moments = [...state.moments].sort((a, b) => b.at - a.at)

  return (
    <>
      <Header title="It worked" sub="When remembering a name actually mattered, write the line. Ten seconds now, worth a lot in November." back="/today" />

      <div className="card">
        <div className="field">
          <label htmlFor="what">What happened</label>
          <textarea
            id="what"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Greeted Priya by name at the second meeting. She noticed."
          />
        </div>
        <div className="field">
          <label htmlFor="who">Who (optional)</label>
          <select id="who" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">—</option>
            {state.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="chips">
          {(
            [
              ['GOOD', 'Good'],
              ['GREAT', 'Great'],
              ['RELIEF', 'Relief'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} className={`chip${feeling === value ? ' on' : ''}`} onClick={() => setFeeling(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button
          className="primary full"
          disabled={text.trim().length === 0}
          onClick={async () => {
            await state.logMoment(text.trim(), feeling, subjectId || undefined, Date.now())
            setText('')
            setSubjectId('')
          }}
        >
          Save the moment
        </button>
      </div>

      <h2>{moments.length} moments</h2>
      {moments.length === 0 ? (
        <Empty title="Nothing logged yet" body="The first one usually happens sooner than people expect — often in week two, at a second meeting." />
      ) : (
        moments.map((m) => {
          const person = state.people.find((p) => p.id === m.subjectId)
          return (
            <div key={m.id} className="card tight">
              <div className="row between">
                <span className="dim">{new Date(m.at).toLocaleDateString()}</span>
                <span className="pill">{m.feeling.toLowerCase()}</span>
              </div>
              <p style={{ margin: '6px 0 0' }}>{m.text}</p>
              {person && <div className="dim">{person.displayName}</div>}
            </div>
          )
        })
      )}

      <Evidence>
        Reviewing this list is a scheduled part of the weekly loop, and one of the app’s own testable
        hypotheses is that reading it predicts the following week’s adherence better than the streak
        does. If that turns out to be true, this screen matters more than the streak.
      </Evidence>
    </>
  )
}
