import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { selectPlan, useStore } from '../../state/store'
import type { CueLevel, Grade, ScheduleItem } from '../../domain/types'
import { INSTANT_THRESHOLD_MS } from '../../domain/types'
import { buildCue, easeCue } from '../../domain/scheduler/cueLadder'
import { competenceFeedback } from '../../domain/engagement/rewards'
import { nextDrillImage } from '../../domain/faceVariety'
import { currentIntervalLabel } from '../../domain/scheduler/schedule'
import { useNow, useTicker } from '../hooks'
import { Empty, Evidence, Header } from '../components'

/**
 * The session loop.
 *
 * Two rules are enforced structurally rather than by good intentions:
 *
 * - **Test before you peek.** The answer is never rendered alongside the prompt. Re-reading a name
 *   feels productive and is far weaker than retrieving it; the UI removes the option.
 * - **Errorful by default.** A cue is available but must be asked for, and asking is recorded as a
 *   tip-of-the-tongue rather than quietly forgiven. Cues are only pre-offered for items that have
 *   lapsed repeatedly, which is the narrow case where errorless learning is the better bet.
 */
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

  // Items that have lapsed repeatedly get their cue up front — the errorless fallback.
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
        <Header title="Session" back="/today" />
        {lastFeedback && <div className="card accent">{lastFeedback}</div>}
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
          <p className="dim center">
            {plan.queue.deferred.length} more are due but held back by today’s ceiling. They are not
            lost — the cap exists so a queue never becomes a wall.
          </p>
        )}
      </>
    )
  }

  const cue = buildCue(cueLevel, person.givenName, {
    context: person.context,
    phonetic: person.phonetic,
    distractors: state.people.filter((p) => p.id !== person.id).map((p) => p.givenName),
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
      <Header title={`${index + 1} of ${queue.length}`} back="/today" />

      {state.pendingRewards.length > 0 && (
        <div>
          {state.pendingRewards.map((r, i) => (
            <div key={`${r.kind}-${i}`} className="reward">
              <strong>{r.headline}</strong>
              <div className="small muted">{r.detail}</div>
            </div>
          ))}
          <button className="full ghost small" onClick={() => state.clearRewards()}>
            Dismiss
          </button>
        </div>
      )}

      {lastFeedback && !revealed && <div className="dim center">{lastFeedback}</div>}

      {dividedMode && <DividedAttentionTask />}

      <div className="card">
        {item.mode === 'FACE_TO_NAME' && (
          <>
            {image ? (
              <img className="face" src={image.src} alt="" />
            ) : (
              <div className="face face-placeholder" aria-hidden>
                ?
              </div>
            )}
            {!image && (
              <p className="small muted" style={{ marginTop: 10 }}>
                {/* Deliberately not naming them — that would be the answer. */}
                No photo yet. Retrieve from the context instead:{' '}
                {person.context || 'nothing recorded, so this one is a cold guess'}.
              </p>
            )}
          </>
        )}

        {item.mode === 'NAME_TO_FACE' && <div className="big-prompt">{person.displayName}</div>}

        {item.mode === 'CAST_RECALL' && (
          <div className="center">
            <div className="dim">{person.collection}</div>
            <div className="big-prompt">{person.role ?? 'this character'}</div>
          </div>
        )}

        {item.mode === 'PLACE_RECALL' && (
          <div className="center">
            <div className="dim">{person.collection}</div>
            <div className="big-prompt">{person.context}</div>
          </div>
        )}

        {cueLevel !== 'FREE' && cue.text && (
          <div className="card tight" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="dim">cue</div>
            <div>{cue.text}</div>
            {cue.choices && (
              <div className="chips" style={{ marginTop: 8 }}>
                {cue.choices.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!revealed ? (
        <>
          <button
            className="primary full"
            onClick={() => {
              setRevealed(true)
            }}
          >
            {item.mode === 'NAME_TO_FACE' ? 'Show them' : 'Show the name'}
          </button>
          <div className="spacer" />
          <button
            className="full ghost"
            disabled={cueLevel === 'RESTUDY'}
            onClick={() => setCueLevel((c) => easeCue(c))}
          >
            I need a cue
          </button>
          <div className="dim center" style={{ marginTop: 8 }}>
            Asking for a cue is recorded as a tip-of-the-tongue, not as a success. That is the honest
            reading: the identity resolved, the name did not.
          </div>
        </>
      ) : (
        <>
          <div className="card accent center">
            {item.mode === 'NAME_TO_FACE' && image ? (
              <img className="face" src={image.src} alt="" />
            ) : (
              <div className="big-prompt" style={{ margin: '6px 0' }}>
                {person.displayName}
              </div>
            )}
            {person.phonetic && <div className="dim">{person.phonetic}</div>}
            {person.hook && <div className="small muted">{person.hook}</div>}
          </div>

          <div className="grades">
            <button className="grade-miss" onClick={() => void grade('MISS')}>
              Gone
            </button>
            <button className="grade-cued" onClick={() => void grade('CUED')}>
              On the tip of my tongue
            </button>
            <button className="grade-got" onClick={() => void grade('GOT')}>
              Had it
            </button>
            <button className="grade-instant" onClick={() => void grade('INSTANT')}>
              Instantly
            </button>
          </div>
          <div className="dim center" style={{ marginTop: 10 }}>
            Currently holding: {currentIntervalLabel(item, state.settings)} ·{' '}
            {item.lapses > 0 ? `${item.lapses} lapse${item.lapses === 1 ? '' : 's'}` : 'no lapses'} ·
            “Instantly” means under {INSTANT_THRESHOLD_MS / 1000}s
          </div>
        </>
      )}

      {state.settings.phase >= 3 && (
        <>
          <div className="spacer" />
          <button className={`full ghost${dividedMode ? ' ' : ''}`} onClick={() => setDividedMode((d) => !d)}>
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
 * The secondary task: a digit stream with a target to catch.
 *
 * Not a game and not scored competitively — its only job is to occupy the attention that a real
 * conversation would occupy, so that retrieval is practised under the conditions it will be used in.
 */
function DividedAttentionTask() {
  const tick = useTicker(true, 1400)
  const [hits, setHits] = useState(0)
  const digit = (tick * 7 + 3) % 10
  return (
    <div className="card tight">
      <div className="row between">
        <div>
          <div className="dim">second task — tap when you see a 7</div>
          <div style={{ fontSize: '1.8rem', fontVariantNumeric: 'tabular-nums' }}>{digit}</div>
        </div>
        <div className="row">
          <span className="dim mono">{hits}</span>
          <button onClick={() => setHits((h) => (digit === 7 ? h + 1 : h))}>Tap</button>
        </div>
      </div>
    </div>
  )
}
