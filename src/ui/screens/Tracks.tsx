import { useState } from 'react'
import { useStore, type CaptureDraft } from '../../state/store'
import type { TrackKind } from '../../domain/types'
import { drillById } from '../../domain/drills/registry'
import { Empty, Evidence, Header } from '../components'

/**
 * The adjacent tracks: names in stories, and place names.
 *
 * These run on the same retrieval engine as people, and they do two jobs. They train genuinely
 * adjacent targets — character names are governed by situation-model construction, place names run
 * on the same left-temporal-pole naming machinery — and they keep the daily loop satisfiable during
 * socially quiet weeks, which is what stops a streak from requiring an extroverted calendar.
 */
export default function Tracks() {
  const state = useStore()
  const [track, setTrack] = useState<Exclude<TrackKind, 'PERSON'>>('CAST')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [collection, setCollection] = useState('')

  const entries = state.people.filter((p) => p.track === track).sort((a, b) => b.metAt - a.metAt)
  const drill = drillById(track === 'CAST' ? 'CAST_RECALL' : 'PLACE_RECALL')
  const locked = state.settings.phase < drill.minPhase

  async function add() {
    const draft: CaptureDraft = {
      givenName: name.trim(),
      setting: track === 'PLACE' ? collection.trim() : '',
      likelihoodOfMeetingAgain: 'MEDIUM',
      adherence: { heard: true, said: true, looked: true, hooked: role.trim().length > 0 },
      context: { noise: 'QUIET', alcohol: false, fatigue: 1, stress: 1, setting: collection.trim() },
      track,
      role: role.trim() || undefined,
      collection: collection.trim() || undefined,
    }
    await state.capture(draft, Date.now())
    setName('')
    setRole('')
  }

  return (
    <>
      <Header title="Other tracks" sub="Same engine, different material." back="/program" />

      <div className="chips">
        {(
          [
            ['CAST', 'Cast — books & film'],
            ['PLACE', 'Places'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} className={`chip${track === value ? ' on' : ''}`} onClick={() => setTrack(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>{drill.name}</h3>
        <p className="small muted">{drill.purpose}</p>
        <Evidence>{drill.mechanism}</Evidence>
        {locked && <span className="pill warn">unlocks at phase {drill.minPhase}</span>}
      </div>

      <h2>Add</h2>
      <div className="card">
        <div className="field">
          <label htmlFor="tname">{track === 'CAST' ? 'Character name' : 'Place name'}</label>
          <input id="tname" value={name} onChange={(e) => setName(e.target.value)} placeholder={track === 'CAST' ? 'Ludmilla' : 'Trondheim'} />
        </div>
        <div className="field">
          <label htmlFor="trole">{track === 'CAST' ? 'Role and relationships' : 'Where it is'}</label>
          <input
            id="trole"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={track === 'CAST' ? 'the sister who runs the press' : 'central Norway, on the fjord'}
          />
          {track === 'CAST' && (
            <div className="dim" style={{ marginTop: 4 }}>
              Roles and relationships, not just names — that is what builds the situation model, and
              the model is what keeps the cast straight.
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="tcoll">{track === 'CAST' ? 'Which book or film' : 'Region or map'}</label>
          <input id="tcoll" value={collection} onChange={(e) => setCollection(e.target.value)} />
        </div>
        <button className="primary full" disabled={name.trim().length === 0} onClick={() => void add()}>
          Add
        </button>
      </div>

      <h2>{entries.length} in this track</h2>
      {entries.length === 0 ? (
        <Empty title="Empty" body="Add the cast at the end of a chapter, or a handful of places off a map you actually care about." />
      ) : (
        entries.map((e) => (
          <div key={e.id} className="card tight">
            <div className="row between">
              <strong>{e.displayName}</strong>
              <span className="dim">{e.collection}</span>
            </div>
            {e.role && <div className="small muted">{e.role}</div>}
          </div>
        ))
      )}
    </>
  )
}
