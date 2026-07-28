import { useState } from 'react'
import { useStore, type CaptureDraft } from '../../state/store'
import type { TrackKind } from '../../domain/types'
import { drillById } from '../../domain/drills/registry'
import { Chips, Empty, Evidence, Header, PersonName } from '../components'

type Track = Exclude<TrackKind, 'PERSON'>

const TRACKS: { value: Track; label: string }[] = [
  { value: 'CAST', label: 'Cast — books & film' },
  { value: 'PLACE', label: 'Places' },
]

/**
 * The adjacent tracks: names in stories, and place names.
 *
 * These run on the same retrieval engine as people, and they do two jobs. They train genuinely
 * adjacent targets — character names are governed by situation-model construction, place names run
 * on the same left-temporal-pole naming machinery — and they keep the daily loop satisfiable during
 * socially quiet weeks, which is what stops a streak from requiring an extroverted calendar.
 *
 * The screen is deliberately the same instrument as People: the same register, the same rules, the
 * same rows. Sameness is the argument — one engine, different material.
 *
 * The one thing that must never blur is the face. A character in a novel **is a person** and takes
 * the serif; a place is not and takes the sans. `PersonName` branches on `person.track` rather than
 * on this screen, because CAST and PERSON share a type and the reservation has to survive being
 * read by someone who has never opened this file.
 */
export default function Tracks() {
  const state = useStore()
  const [track, setTrack] = useState<Track>('CAST')
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

      <Chips<Track> options={TRACKS} value={track} onChange={setTrack} label="Track" />

      <div className="card" style={{ marginBlockStart: 'var(--s-5)' }}>
        <h3>{drill.name}</h3>
        <p className="small muted">{drill.purpose}</p>
        {/* Locked is a mode, not a fault: a bordered label and a word. No padlock, no tint, and
            the card keeps its full contrast — a drill you have not reached is not a broken one. */}
        {locked && (
          <p className="record-note">
            <span className="pill">phase {drill.minPhase}</span> Not in rotation yet — it opens when
            you reach that phase.
          </p>
        )}
        <Evidence>{drill.mechanism}</Evidence>
      </div>

      <h2>Add</h2>
      <div className="card">
        <div className="field">
          <label htmlFor="tname">{track === 'CAST' ? 'Character name' : 'Place name'}</label>
          <input
            id="tname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={track === 'CAST' ? 'Ludmilla' : 'Trondheim'}
          />
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
            <p className="dim">
              Roles and relationships, not just names — that is what builds the situation model, and
              the model is what keeps the cast straight.
            </p>
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

      <h2>
        <span>
          <span className="fig">{entries.length}</span> in this track
        </span>
      </h2>
      {entries.length === 0 ? (
        <Empty
          title="Empty"
          body="Add the cast at the end of a chapter, or a handful of places off a map you actually care about."
        />
      ) : (
        <div>
          {entries.map((e) => {
            const under = [e.role, e.collection].filter(Boolean).join(' · ')
            return (
              <div
                key={e.id}
                className="row row-rule"
                style={{ paddingBlock: 'var(--s-3)', minBlockSize: 'var(--tap)' }}
              >
                <div className="grow">
                  {/* Serif for a character, sans for a place. The change of face is the whole
                      statement: a person, and not a person. */}
                  <div style={{ fontSize: 'var(--t-lede)', lineHeight: 'var(--lh-lede)' }}>
                    <PersonName person={e} />
                  </div>
                  {under && <div className="dim">{under}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
