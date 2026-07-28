import { useState } from 'react'
import { useStore } from '../../state/store'
import type { Moment } from '../../domain/types'
import { Chips, Empty, Evidence, Header, PersonName } from '../components'

/**
 * The Moment Journal — a dated ledger.
 *
 * The actual reward for this practice happens off-app: someone's face when you greet them by name
 * three weeks after meeting them once. The app cannot see that, so it asks.
 *
 * This is the most important screen in the application at month nine, when the novelty is gone and
 * the queue is a chore. So the user's own sentence gets the largest type on the page after a name,
 * and the entries are set as rows on rules rather than in cards — a ledger reads as a record that
 * accumulates, which is exactly what this is.
 */
export default function Journal() {
  const state = useStore()
  const [text, setText] = useState('')
  const [feeling, setFeeling] = useState<Moment['feeling']>('GOOD')
  const [subjectId, setSubjectId] = useState<string>('')

  const moments = [...state.moments].sort((a, b) => b.at - a.at)

  return (
    <>
      <Header
        title="It worked"
        sub="When remembering a name actually mattered, write the line. Ten seconds now, worth a lot in November."
        back="/today"
      />

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
        <div className="field">
          <Chips
            label="How it felt"
            value={feeling}
            onChange={setFeeling}
            options={[
              { value: 'GOOD', label: 'Good' },
              { value: 'GREAT', label: 'Great' },
              { value: 'RELIEF', label: 'Relief' },
            ]}
          />
        </div>
        <button
          className="primary full btn--lg"
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

      <h2>
        {moments.length} moment{moments.length === 1 ? '' : 's'}
      </h2>

      {moments.length === 0 ? (
        <Empty
          title="Nothing logged yet"
          body="The first one usually happens sooner than people expect — often in week two, at a second meeting."
        />
      ) : (
        <div>
          {moments.map((m) => {
            const person = state.people.find((p) => p.id === m.subjectId)
            return (
              <article key={m.id} className="row-rule" style={{ paddingBlock: 'var(--s-5)' }}>
                <div className="row between" style={{ marginBlockEnd: 'var(--s-2)' }}>
                  <span className="retrieval__mode mono">
                    {new Date(m.at).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="pill">{m.feeling.toLowerCase()}</span>
                </div>
                {/* The user's own words. The largest type on this page after a name — because at
                    month nine this sentence is the evidence file that the year is paying off. */}
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--t-lede)',
                    lineHeight: 'var(--lh-lede)',
                    letterSpacing: 'var(--ls-lede)',
                    color: 'var(--ink)',
                  }}
                >
                  {m.text}
                </p>
                {person && (
                  <p className="small" style={{ margin: 'var(--s-2) 0 0', color: 'var(--ink-2)' }}>
                    <PersonName person={person} />
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <Evidence>
        Reviewing this list is a scheduled part of the weekly loop, and one of the app’s own testable
        hypotheses is that reading it predicts the following week’s adherence better than the streak
        does. If that turns out to be true, this screen matters more than the streak.
      </Evidence>
    </>
  )
}
