import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../state/store'
import { currentIntervalLabel } from '../../domain/scheduler/schedule'
import { formatInterval } from '../../domain/time'
import { filesToDataUrls } from '../../lib/image'
import { useNow } from '../hooks'
import { Evidence, FaceConfidenceBadge, Header, Stat } from '../components'

export default function PersonDetail() {
  const { id } = useParams()
  const state = useStore()
  const navigate = useNavigate()
  const now = useNow()
  const person = state.people.find((p) => p.id === id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!person) return <Header title="Not found" back="/people" />

  const items = state.items.filter((i) => i.subjectId === person.id)
  const attempts = state.attempts.filter((a) => a.subjectId === person.id)
  const images = state.media.filter((m) => m.personId === person.id && m.kind === 'IMAGE')
  const held = attempts.filter((a) => a.grade === 'GOT' || a.grade === 'INSTANT').length
  const longest = attempts.reduce((max, a) => Math.max(max, a.delaySinceEncodingMs), 0)
  const flagged = items.some((i) => i.needsReencoding)

  return (
    <>
      <Header title={person.displayName} sub={person.context} back="/people" />

      {person.phonetic && <p className="muted">Sounds like: {person.phonetic}</p>}
      {person.hook && <p className="muted">Hook: {person.hook}</p>}

      {flagged && (
        <div className="card accent">
          <h3>This one needs re-encoding, not more drilling</h3>
          <p className="small muted">
            Three lapses usually means the record is broken rather than your memory — a photo that
            doesn’t look like them, no hook, or a name you never actually heard clearly. Fix the
            record and the schedule restarts.
          </p>
          <Evidence>
            This is also the one place heavy imagery earns its keep: offline, unhurried, for a person
            who matters. It fails in live conversation, but it works fine at a kitchen table.
          </Evidence>
        </div>
      )}

      <h2>Face record</h2>
      <div className="card">
        <FaceConfidenceBadge person={person} media={state.media} />
        <div className="row wrap" style={{ marginTop: 12 }}>
          {images.map((m) => (
            <img key={m.id} src={m.src} alt="" className="avatar" />
          ))}
        </div>
        <div className="spacer" />
        <label htmlFor="more-looks">Add a look from today</label>
        <input
          id="more-looks"
          type="file"
          accept="image/*"
          multiple
          onChange={async (e) => {
            const urls = await filesToDataUrls(e.target.files)
            if (urls.length === 0) return
            await state.addEncounter(
              person.id,
              {
                setting: person.context ?? '',
                adherence: { heard: true, said: false, looked: true, hooked: false },
                context: { noise: 'QUIET', alcohol: false, fatigue: 2, stress: 2, setting: person.context ?? '' },
                imageDataUrls: urls,
              },
              Date.now(),
            )
          }}
        />
        <div className="dim" style={{ marginTop: 6 }}>
          Counted as a new encounter, which is what actually moves the confidence ceiling. Photos
          from the same occasion don’t.
        </div>
      </div>

      <h2>Retrieval history</h2>
      <div className="card">
        <Stat label="Retrievals held" value={`${held}/${attempts.length}`} />
        <Stat label="Longest gap survived" value={longest > 0 ? formatInterval(longest) : '—'} />
        <Stat label="Encounters logged" value={`${person.encounters.length}`} />
        {items.map((i) => (
          <Stat
            key={i.id}
            label={i.mode.replace(/_/g, ' ').toLowerCase()}
            value={`${currentIntervalLabel(i, state.settings)} · due ${i.due > now ? `in ${formatInterval(i.due - now)}` : 'now'}`}
          />
        ))}
      </div>

      <h2>Remove</h2>
      <div className="card">
        <p className="small muted">
          Deleting removes their photos, schedule, and history immediately. There is no trash and no
          soft delete — this is someone else’s face, and it should be as easy to erase as it was to
          store.
        </p>
        {confirmDelete ? (
          <div className="row">
            <button
              className="danger grow"
              onClick={async () => {
                await state.removePerson(person.id)
                navigate('/people')
              }}
            >
              Delete permanently
            </button>
            <button onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button className="danger full" onClick={() => setConfirmDelete(true)}>
            Delete {person.displayName}
          </button>
        )}
      </div>
    </>
  )
}
