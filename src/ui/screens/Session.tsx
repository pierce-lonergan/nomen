import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { selectPlan, useStore } from '../../state/store'
import type { CueLevel, Grade, MediaRef, Person, ScheduleItem } from '../../domain/types'
import { INSTANT_THRESHOLD_MS, isHuman } from '../../domain/types'
import { buildCue, easeCue } from '../../domain/scheduler/cueLadder'
import { competenceFeedback } from '../../domain/engagement/rewards'
import { nextDrillImage } from '../../domain/faceVariety'
import { currentIntervalLabel } from '../../domain/scheduler/schedule'
import { useNow, useTicker } from '../hooks'
import { Empty, Evidence, Header, PersonName } from '../components'
import { mediaSrc } from '../../lib/media'

/**
 * The session loop — and the reveal, which is the emotional core of the application.
 *
 * Two rules are enforced structurally rather than by good intentions:
 *
 * - **Test before you peek.** `.answer__set` is mounted from the start so its transition can fire
 *   on the attribute flip, but its *children* — the name, the phonetic, the hook — are rendered
 *   only once `revealed` is true. The answer is genuinely not in the document before the user
 *   asks for it. Do not "simplify" this by hiding the name with CSS; that would put the answer in
 *   the DOM beside the prompt and defeat the rule this screen exists to enforce.
 * - **Errorful by default.** A cue is available but must be asked for, and asking is recorded as
 *   a tip-of-the-tongue rather than quietly forgiven.
 *
 * The reveal is a draughtsman ruling a line: the gate unmounts, the dashed rule fades, a 2px
 * accent rule draws itself left to right, and 40ms into that draw the name rises 6px and lands on
 * it. The accent appears exactly once per card and this is it. No flash, no burst, no haptic.
 */

const GRADES: { grade: Grade; label: string; sub: string; strength: 0 | 1 | 2 | 3 }[] = [
  { grade: 'MISS', label: 'Gone', sub: 'comes back sooner', strength: 0 },
  { grade: 'CUED', label: 'On the tip of my tongue', sub: 'counts as a miss', strength: 1 },
  { grade: 'GOT', label: 'Had it', sub: 'interval expands', strength: 2 },
  { grade: 'INSTANT', label: 'Instantly', sub: `under ${INSTANT_THRESHOLD_MS / 1000}s`, strength: 3 },
]

const MODE_LABEL: Record<string, string> = {
  FACE_TO_NAME: 'face → name',
  NAME_TO_FACE: 'name → face',
  VOICE_TO_NAME: 'voice → name',
  CAST_RECALL: 'cast',
  PLACE_RECALL: 'place',
}

export default function Session() {
  const state = useStore()
  const navigate = useNavigate()
  const now = useNow(5000)
  const plan = useMemo(() => selectPlan(state, now), [state, now])

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [cueLevel, setCueLevel] = useState<CueLevel>('FREE')
  const [lastFeedback, setLastFeedback] = useState<string | null>(null)
  const [dividedMode, setDividedMode] = useState(false)
  const [lastImageId, setLastImageId] = useState<string | null>(null)
  const startedAt = useRef<number>(Date.now())

  const queue = plan.queue.queue
  const item: ScheduleItem | undefined = queue[index]
  const person = state.people.find((p) => p.id === item?.subjectId)

  useEffect(() => {
    if (!item) return
    startedAt.current = Date.now()
    setRevealed(false)
    setCueLevel(item.cueFloor)
  }, [item?.id])

  const image = useMemo(
    () => (person ? nextDrillImage(person, state.media, lastImageId) : null),
    [person, state.media, lastImageId],
  )

  if (!item || !person) {
    return (
      <>
        <QueueCleared />
        <Header title="Session" back="/today" />
        {lastFeedback && <p className="held">{lastFeedback}</p>}
        <Empty
          title="Queue clear"
          body="Nothing else is due. The next thing that matters happens away from the phone — the four beats at the next introduction."
          action={
            <button className="primary" onClick={() => navigate('/today')}>
              Done
            </button>
          }
        />
        {plan.queue.deferred.length > 0 && (
          <p className="record-note">
            {plan.queue.deferred.length} more are due but held back by today’s ceiling. They are not
            lost — the cap exists so a queue never becomes a wall.
          </p>
        )}
      </>
    )
  }

  // Foils must be the same KIND of thing, or the four-choice cue is not a test. Offering
  // "Trondheim / Sarah / Priya / Marcus" gives the answer away by category alone; so does mixing
  // two novels' casts. Same track and collection first, falling back to same track.
  const sameCollection = state.people.filter(
    (p) => p.id !== person.id && p.track === person.track && p.collection === person.collection,
  )
  const sameTrack = state.people.filter((p) => p.id !== person.id && p.track === person.track)
  const foils = (sameCollection.length >= 3 ? sameCollection : sameTrack).map((p) => p.givenName)

  const nameFace = isHuman(person.track) ? 'person-name' : ''

  const cue = buildCue(cueLevel, person.givenName, {
    context: person.context,
    phonetic: person.phonetic,
    distractors: foils,
  })

  async function grade(g: Grade) {
    if (!item) return
    const latency = Date.now() - startedAt.current
    await state.grade(item.id, g, latency, cueLevel, dividedMode, Date.now())
    setLastFeedback(competenceFeedback(item.lastReviewedAt ? Date.now() - item.lastReviewedAt : 0, g))
    if (image) setLastImageId(image.id)
    setIndex((i) => i + 1)
  }

  return (
    <>
      {/* The visible register carries the mode, so the h1 is for orientation only — but a page
          with no level-one heading is a page a screen-reader user cannot orient in. */}
      <h1 className="sr-only">Retrieval session</h1>

      {state.pendingRewards.length > 0 && (
        <div>
          {state.pendingRewards.map((r, i) => {
            const subject = state.people.find((p) => p.id === r.subjectId)
            return (
              <div key={`${r.kind}-${i}`} className="reward">
                <span className="reward__kicker">{r.kind.replace('_', ' ')}</span>
                <p className="reward__headline">{r.headline}</p>
                <p className="reward__detail">
                  {subject && (
                    <>
                      <PersonName person={subject} />{' '}
                    </>
                  )}
                  {r.detail}
                </p>
              </div>
            )
          })}
          <button className="ghost small" onClick={() => state.clearRewards()}>
            Dismiss
          </button>
        </div>
      )}

      {dividedMode && <DividedAttentionTask />}

      <section className="retrieval queue-row" data-in="true" key={item.id}>
        <div className="retrieval__register">
          <span className="retrieval__mode">{MODE_LABEL[item.mode] ?? item.mode}</span>
          <span className="retrieval__count mono">
            {String(index + 1).padStart(2, '0')} / {String(queue.length).padStart(2, '0')}
          </span>
        </div>

        <Prompt item={item} person={person} image={image} />

        {cueLevel !== 'FREE' && cue.text && (
          <div>
            <span className="retrieval__mode">cue</span>
            <p style={{ margin: 'var(--s-1) 0 0' }}>
              {cue.text}
              {cue.name && (
                <>
                  {' '}
                  <span className={nameFace}>{cue.name}</span>
                </>
              )}
            </p>
            {cue.choices && (
              <div className="chips" style={{ marginBlockStart: 'var(--s-2)' }}>
                {cue.choices.map((c) => (
                  <span key={c} className={`chip ${nameFace}`.trim()}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* The answer slot. At rest it is a blank scale, not an empty box — the line is blank
            because the user has not retrieved it yet, and that is the honest picture. */}
        <div className="answer" data-revealed={revealed ? 'true' : 'false'}>
          <span className="answer__rule" aria-hidden />
          <div className="answer__slot">
            <p className="answer__rest">not retrieved yet</p>
            <div className="answer__set" aria-live="polite">
              {revealed && (
                <>
                  {item.mode === 'NAME_TO_FACE' && image ? (
                    <>
                      <img className="face" src={mediaSrc(image)} alt="" />
                      {/* The image IS the answer here, and alt="" leaves the live region with
                          nothing to announce. The name is the non-visual equivalent. */}
                      <p className="sr-only">{person.displayName}</p>
                    </>
                  ) : (
                    <p className="answer__name">{person.displayName}</p>
                  )}
                  {person.phonetic && <p className="answer__phonetic">{person.phonetic}</p>}
                  {person.hook && <p className="answer__hook">{person.hook}</p>}
                </>
              )}
            </div>
          </div>
        </div>

        {!revealed ? (
          <div className="retrieval__gate">
            <button className="primary full btn--lg" onClick={() => setRevealed(true)}>
              {item.mode === 'NAME_TO_FACE' ? 'Show them' : 'Show the name'}
            </button>
            <button
              className="full ghost"
              disabled={cueLevel === 'RESTUDY'}
              onClick={() => setCueLevel((c) => easeCue(c))}
            >
              I need a cue
            </button>
            <p className="record-note">
              Asking for a cue is recorded as a tip-of-the-tongue, not as a success. That is the
              honest reading: the identity resolved, the name did not.
            </p>
          </div>
        ) : (
          <div>
            <div className="grades">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  className="grade"
                  data-strength={g.strength}
                  onClick={() => void grade(g.grade)}
                >
                  {g.label}
                  <span className="grade__sub">{g.sub}</span>
                </button>
              ))}
            </div>
            <p className="dim" style={{ marginBlockStart: 'var(--s-3)' }}>
              Currently holding <span className="fig">{currentIntervalLabel(item, state.settings)}</span> ·{' '}
              <span className="fig">{item.lapses}</span> lapse{item.lapses === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </section>

      {lastFeedback && !revealed && <p className="held">{lastFeedback}</p>}

      {state.settings.phase >= 3 && (
        <>
          <button className="full ghost" onClick={() => setDividedMode((d) => !d)}>
            {dividedMode ? 'Stop the second task' : 'Add a second task (under load)'}
          </button>
          <Evidence>
            Imagery mnemonics gave no benefit when attempted during real conversation, and retrieval
            practice under divided attention barely beat spontaneous rehearsal. If the skill has to
            survive a conversation, some of the practice has to happen with your attention split.
          </Evidence>
        </>
      )}
    </>
  )
}

/**
 * Records that the pre-sleep consolidation review actually happened.
 *
 * Without this the flag was only ever set by the demo generator, so H1 — the app's own shipped
 * self-experiment about whether the pre-sleep slot is the strongest habit anchor — could never
 * accumulate a with-review arm, and the Evidence note promising the loop's assumptions are
 * "testable on your data" was writing a cheque the app could not cash.
 */
function QueueCleared() {
  const state = useStore()
  const now = useNow(60_000)
  const plan = selectPlan(state, now)
  const alreadyLogged = state.days.find((d) => d.day === plan.day)?.preSleepReviewDone

  useEffect(() => {
    if (plan.timeOfDay === 'PRE_SLEEP' && !alreadyLogged) void state.markPreSleepDone(Date.now())
    // Fires once per evening, when the queue is genuinely clear in the consolidation window.
  }, [plan.timeOfDay, alreadyLogged])

  return null
}

/**
 * The prompt.
 *
 * The serif is reserved to human beings, so a `NAME_TO_FACE` or `CAST_RECALL` prompt is set in it
 * and a `PLACE_RECALL` prompt is not. The branch is on `person.track` rather than on the mode,
 * because CAST and PERSON share a type and a place must never wear a person's face.
 */
function Prompt({
  item,
  person,
  image,
}: {
  item: ScheduleItem
  person: Person
  image: MediaRef | null
}) {
  // FACE_TO_NAME only. A VOICE_TO_NAME prompt showing a photograph is the face drill wearing the
  // wrong label — it would measure the route it was meant to bypass. The mode cannot be scheduled
  // until recording exists (see the drill registry), and this branch must not quietly accept it.
  if (item.mode === 'FACE_TO_NAME') {
    return image ? (
      <img className="face" src={mediaSrc(image)} alt="" />
    ) : (
      <div className="face-placeholder">
        {/* Deliberately not naming them — that would be the answer. */}
        No photograph yet. Retrieve from the context instead:{' '}
        {person.context || 'nothing recorded, so this one is a cold guess'}.
      </div>
    )
  }

  // Branch on the CONTENT, not only on the track. A cast prompt shows the character's *role*
  // ("the sister who runs the press"), and a role is not a name — it must not wear the face
  // reserved for people, even though the subject behind it is a person.
  const text =
    item.mode === 'NAME_TO_FACE' ? person.displayName : (person.role ?? person.context ?? person.displayName)
  const showingName = text === person.displayName
  const asName = isHuman(person.track) && showingName

  return (
    <div>
      {person.collection && <p className="retrieval__collection">{person.collection}</p>}
      <p className={`retrieval__prompt-text${asName ? ' person-name' : ' retrieval__prompt-text--label'}`}>
        {text}
      </p>
    </div>
  )
}

/**
 * The secondary task: a digit stream with a target to catch.
 *
 * Not a game and not scored competitively — its only job is to occupy the attention a real
 * conversation would occupy, so retrieval is practised under the conditions it will be used in.
 */
function DividedAttentionTask() {
  const tick = useTicker(true, 1400)
  const [hits, setHits] = useState(0)
  const digit = (tick * 7 + 3) % 10
  return (
    <div className="card tight">
      <div className="row between">
        <div>
          <span className="retrieval__mode">second task — tap on 7</span>
          <p className="mono" style={{ fontSize: 'var(--t-figure)', margin: 'var(--s-1) 0 0' }}>
            {digit}
          </p>
        </div>
        <div className="row">
          <span className="dim mono">{hits}</span>
          <button onClick={() => setHits((h) => (digit === 7 ? h + 1 : h))}>Tap</button>
        </div>
      </div>
    </div>
  )
}
