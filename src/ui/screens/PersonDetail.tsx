import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../state/store'
import { isHuman } from '../../domain/types'
import { currentIntervalLabel } from '../../domain/scheduler/schedule'
import { formatInterval } from '../../domain/time'
import { filesToBlobs } from '../../lib/image'
import { useNow } from '../hooks'
import { Evidence, FaceConfidenceBadge, Header, PersonName, Stat } from '../components'
import { IconBack } from '../icons'
import { mediaSrc } from '../../lib/media'

/**
 * One person's record.
 *
 * This is the only screen in the application whose *subject* is a human being, and so it is the
 * only one that does not take its title from `Header`. `Header` sets an h1 in the sans, which is
 * right for "Insights" and wrong for a name: here the title **is** a name, so it is set in the
 * serif at `--t-name` — the largest type in the app — and the phonetic and hook hang off it in the
 * same order the reveal uses on Session. The record simply stands permanently revealed.
 *
 * The branch is on `person.track`, never on the screen: CAST, PERSON and PLACE all ride the same
 * record, and a place must never wear a person's face. It is still an `h1`, because a page with no
 * level-one heading is a page a screen-reader user cannot orient in.
 *
 * The photographs are square, not round. A circle is this system's sign for *a person*; these are
 * photographs **of** a person, so they are tipped onto the page as plates — 96px, 2px corner,
 * hairline edge — rather than repeated as eleven tiny avatars of someone already named above.
 */
export default function PersonDetail() {
  const { id } = useParams()
  const state = useStore()
  const navigate = useNavigate()
  const now = useNow()
  const person = state.people.find((p) => p.id === id)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /* The file input is visually hidden so the visible control can be a real button. It stays in the
     tab order, so the label standing in for it has to borrow its focus ring. */
  const [photoFocused, setPhotoFocused] = useState(false)

  if (!person) return <Header title="Not found" back="/people" />

  const items = state.items.filter((i) => i.subjectId === person.id)
  const attempts = state.attempts.filter((a) => a.subjectId === person.id)
  const images = state.media.filter((m) => m.personId === person.id && m.kind === 'IMAGE')
  const held = attempts.filter((a) => a.grade === 'GOT' || a.grade === 'INSTANT').length
  const longest = attempts.reduce((max, a) => Math.max(max, a.delaySinceEncodingMs), 0)
  const flagged = items.some((i) => i.needsReencoding)

  return (
    <>
      <header>
        <Link
          to="/people"
          className="small"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--s-1)',
            minBlockSize: 'var(--tap)',
          }}
        >
          <IconBack />
          Back
        </Link>

        <h1
          className={isHuman(person.track) ? 'answer__name' : undefined}
          style={isHuman(person.track) ? { marginBlock: 'var(--s-5) var(--s-2)' } : undefined}
        >
          {person.displayName}
        </h1>

        {person.context && <p className="standfirst">{person.context}</p>}
        {person.phonetic && <p className="answer__phonetic">Sounds like: {person.phonetic}</p>}
        {person.hook && <p className="answer__hook">Hook: {person.hook}</p>}
      </header>

      {flagged && (
        <div className="card accent" style={{ marginBlockStart: 'var(--s-6)' }}>
          <h3>This one needs re-encoding, not more drilling</h3>
          <p className="muted">
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

        {images.length > 0 ? (
          <div className="row wrap" style={{ marginBlockStart: 'var(--s-4)' }}>
            {images.map((m) => (
              <img
                key={m.id}
                className="face"
                src={mediaSrc(m)}
                alt=""
                style={{ inlineSize: 96, flex: '0 0 auto' }}
              />
            ))}
          </div>
        ) : (
          /* An empty plate, not a hole: the frame is drawn, there is simply nothing on it yet. */
          <div
            className="face-placeholder"
            style={{ marginBlockStart: 'var(--s-4)', maxInlineSize: '17rem' }}
          >
            No photograph yet.
          </div>
        )}

        {/* The file input keeps its own semantics and its place in the tab order; it is simply set
            to zero opacity underneath the label, which is the visible control. Never display:none. */}
        <div className="field" style={{ marginBlockStart: 'var(--s-5)', marginBlockEnd: 0 }}>
          <label htmlFor="more-looks">Add a look from today</label>
          <label
            className="btn"
            htmlFor="more-looks"
            style={{
              position: 'relative',
              overflow: 'hidden',
              ...(photoFocused ? { outline: '2px solid var(--focus)', outlineOffset: '2px' } : null),
            }}
            onFocus={() => setPhotoFocused(true)}
            onBlur={() => setPhotoFocused(false)}
          >
            <input
              id="more-looks"
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                const blobs = await filesToBlobs(e.target.files)
                if (blobs.length === 0) return
                await state.addEncounter(
                  person.id,
                  {
                    setting: person.context ?? '',
                    adherence: { heard: true, said: false, looked: true, hooked: false },
                    context: {
                      noise: 'QUIET',
                      alcohol: false,
                      fatigue: 2,
                      stress: 2,
                      setting: person.context ?? '',
                    },
                    imageBlobs: blobs,
                  },
                  Date.now(),
                )
              }}
              style={{
                position: 'absolute',
                inset: 0,
                inlineSize: '100%',
                blockSize: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
            Choose a photo
          </label>
          <p className="dim">
            Counted as a new encounter, which is what actually moves the confidence ceiling. Photos
            from the same occasion don’t.
          </p>
        </div>
      </div>

      <h2>Retrieval history</h2>
      <div className="card">
        <Stat label="Retrievals held" value={`${held}`} n={attempts.length} />
        {/* A gap nobody has survived yet is not a zero — it is a measurement that has not happened,
            so the row sets a figure dash in the number's slot and keeps its n. */}
        <Stat
          label="Longest gap survived"
          value={formatInterval(longest)}
          n={attempts.length}
          insufficient={longest === 0}
        />
        <Stat label="Encounters logged" value={`${person.encounters.length}`} />
        {items.map((i) => (
          <Stat
            key={i.id}
            label={`${i.mode.replace(/_/g, ' ').toLowerCase()} · due`}
            /* No `n` here: a due date is not a statistic, and "n = 28" beside "now" would claim a
               sample size for something that has none. The repetition count belongs in the hint. */
            hint={`holding ${currentIntervalLabel(i, state.settings)} · ${i.reps} reps`}
            value={i.due > now ? formatInterval(i.due - now) : 'now'}
          />
        ))}
      </div>

      <h2>Remove</h2>
      <div className="card">
        <p className="muted">
          Deleting removes their photos, schedule, and history immediately. There is no trash and no
          soft delete — this is someone else’s face, and it should be as easy to erase as it was to
          store.
        </p>
        {confirmDelete ? (
          <div className="row">
            <button
              className="danger grow"
              data-confirm="true"
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
            Delete <PersonName person={person} />
          </button>
        )}
      </div>
    </>
  )
}
