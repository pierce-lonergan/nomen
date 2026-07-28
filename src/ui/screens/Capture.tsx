import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, type CaptureDraft } from '../../state/store'
import type { MeetAgainLikelihood, NoiseLevel, Person, ProtocolAdherence } from '../../domain/types'
import { filesToDataUrls } from '../../lib/image'
import { Chips, Evidence, Header, PersonName } from '../components'
import { IconCheck, IconCircle } from '../icons'

/**
 * The Capture screen — the moment loop.
 *
 * Two hard constraints from the research shape this screen:
 *
 * 1. It must survive a four-second interaction. Standing in front of someone with a phone out is
 *    socially expensive, so **one field creates a valid person** and everything else can be filled
 *    in later. A capture flow that demands eight fields is a capture flow that gets skipped.
 *
 * 2. There is no imagery step. Patton (1994) found the keyword-image method gave no benefit when
 *    attempted during real conversation — it collapses under divided attention. The live protocol
 *    is hear / say / look / hook, and heavy imagery is confined to offline review.
 *
 * The confirmation is the screen's signature moment, and it is deliberately the quietest thing in
 * the application: one word, one rule, one figure. No burst, no tick, no animation. A capture that
 * congratulates itself is a capture that has mistaken the app for the point.
 */

const BEATS: { key: keyof ProtocolAdherence; label: string; instruction: string }[] = [
  {
    key: 'heard',
    label: 'HEAR',
    instruction: 'Did the name actually arrive? If there is any doubt, ask now — “sorry, once more?”',
  },
  {
    key: 'said',
    label: 'SAY',
    instruction: 'Say it back out loud, in a sentence. “Good to meet you, Sarah.”',
  },
  {
    key: 'looked',
    label: 'LOOK',
    instruction: 'Look at their face while you say it. Attention outward, not on how you’re coming across.',
  },
  {
    key: 'hooked',
    label: 'HOOK',
    instruction: 'One association. Five words. Not a memory palace.',
  },
]

export default function Capture() {
  const state = useStore()
  const navigate = useNavigate()

  const [adherence, setAdherence] = useState<ProtocolAdherence>({
    heard: false,
    said: false,
    looked: false,
    hooked: false,
  })
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [hook, setHook] = useState('')
  const [setting, setSetting] = useState('')
  const [likelihood, setLikelihood] = useState<MeetAgainLikelihood>('MEDIUM')
  const [noise, setNoise] = useState<NoiseLevel>('QUIET')
  const [alcohol, setAlcohol] = useState(false)
  const [fatigue, setFatigue] = useState(2)
  const [stress, setStress] = useState(2)
  const [images, setImages] = useState<string[]>([])
  const [saved, setSaved] = useState<Person | null>(null)
  const [showContext, setShowContext] = useState(false)
  /* The file input is visually hidden so the visible control can be a real button. It is still in
     the tab order, so its focus ring has to be borrowed by the label that stands in for it. */
  const [photoFocused, setPhotoFocused] = useState(false)

  const canSave = givenName.trim().length > 0

  async function save() {
    const now = Date.now()
    const draft: CaptureDraft = {
      givenName: givenName.trim(),
      familyName: familyName.trim() || undefined,
      phonetic: phonetic.trim() || undefined,
      hook: hook.trim() || undefined,
      setting: setting.trim(),
      likelihoodOfMeetingAgain: likelihood,
      adherence,
      context: { noise, alcohol, fatigue, stress, setting: setting.trim() },
      imageDataUrls: images,
    }
    const person = await state.capture(draft, now)
    setSaved(person)
  }

  if (saved) {
    return (
      <>
        <Header title="Caught." />
        <p className="standfirst">
          <PersonName person={saved} /> is in. Your first check is in <span className="fig">20</span>{' '}
          seconds.
        </p>
        <p>
          That one is meant to be easy — an expanding schedule only pays off if the first retrieval
          succeeds, so it is deliberately almost free.
        </p>
        {saved.status === 'ROSTER' && (
          <p className="record-note">
            You have already hit today’s intake cap, so <PersonName person={saved} /> is on the
            roster rather than in rotation. Nothing is lost — they come in tomorrow,
            highest-likelihood first.
          </p>
        )}

        <div className="spacer" />
        <button className="primary full" onClick={() => navigate('/session')}>
          Go to the 20-second check
        </button>
        <button
          className="full ghost"
          onClick={() => {
            setSaved(null)
            setGivenName('')
            setFamilyName('')
            setPhonetic('')
            setHook('')
            setImages([])
            setAdherence({ heard: false, said: false, looked: false, hooked: false })
          }}
        >
          Someone else
        </button>
      </>
    )
  }

  return (
    <>
      <Header
        title="Someone new"
        sub="One field is enough. Fill in the rest later — a capture that takes a minute is a capture you skip."
      />

      <div className="field">
        <label htmlFor="given">Name</label>
        <input
          id="given"
          value={givenName}
          onChange={(e) => setGivenName(e.target.value)}
          placeholder="Sarah"
          autoFocus
          autoComplete="off"
        />
      </div>

      <h2>The four beats</h2>
      <p className="record-note">
        Tap each one as you do it — not as an intention. Adherence is the metric that predicts
        everything downstream, and it only means something if it is honest.
      </p>
      <div style={{ marginBlockStart: 'var(--s-4)' }}>
        {BEATS.map((beat) => {
          const done = adherence[beat.key]
          return (
            <button
              key={beat.key}
              type="button"
              className="beat"
              aria-pressed={done}
              onClick={() => setAdherence((a) => ({ ...a, [beat.key]: !a[beat.key] }))}
            >
              <span className="beat__key">{beat.label}</span>
              <span className="beat__text">{beat.instruction}</span>
              <span className="beat__mark">{done ? <IconCheck /> : <IconCircle />}</span>
            </button>
          )
        })}
      </div>

      <h2>Details</h2>
      <div className="field">
        <label htmlFor="hook">Hook — one association</label>
        <input
          id="hook"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="architect, sails at weekends"
        />
        <p className="dim">
          Semantic and biographical, not appearance. A name is a dead-end label until you connect it
          to something — that is the whole Baker/baker problem.
        </p>
      </div>

      <div className="field">
        <label htmlFor="phonetic">How it sounds</label>
        <input
          id="phonetic"
          value={phonetic}
          onChange={(e) => setPhonetic(e.target.value)}
          placeholder="SAH-ra, not SARE-a"
        />
        <p className="dim">
          Asking for the spelling or origin buys you a second clear hearing and a semantic hook in
          one move. It is the mechanically justified thing to do, not just the polite one.
        </p>
      </div>

      <div className="field">
        <label htmlFor="setting">Where</label>
        <input id="setting" value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="Ana’s birthday" />
      </div>

      <div className="field">
        <label>Likely to meet again?</label>
        <Chips
          value={likelihood}
          onChange={setLikelihood}
          label="Likely to meet again?"
          options={[
            { value: 'HIGH', label: 'Often' },
            { value: 'MEDIUM', label: 'Maybe' },
            { value: 'LOW', label: 'Probably not' },
          ]}
        />
        <p className="dim">
          This drives triage. When the queue is over capacity, the people you will actually see come
          first — a scheduler for people can do that, and a scheduler for flashcards cannot.
        </p>
      </div>

      {/* The file input keeps its own semantics and its place in the tab order; it is simply set to
          zero opacity underneath the label, which is the visible control. Never display:none. */}
      <div className="field">
        <label htmlFor="photo">Photo (optional)</label>
        <label
          className="btn"
          htmlFor="photo"
          style={{
            position: 'relative',
            overflow: 'hidden',
            ...(photoFocused ? { outline: '2px solid var(--focus)', outlineOffset: '2px' } : null),
          }}
          onFocus={() => setPhotoFocused(true)}
          onBlur={() => setPhotoFocused(false)}
        >
          <input
            id="photo"
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => setImages(await filesToDataUrls(e.target.files))}
            style={{
              position: 'absolute',
              inset: 0,
              inlineSize: '100%',
              blockSize: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
          {images.length > 0 ? (
            <>
              Add another look · <span className="fig">{images.length}</span> attached
            </>
          ) : (
            'Choose a photo'
          )}
        </label>
        {images.length > 0 && (
          <div className="row wrap" style={{ marginBlockStart: 'var(--s-3)' }}>
            {images.map((src) => (
              <img key={src} src={src} alt="" className="avatar" />
            ))}
          </div>
        )}
        <Evidence>
          One photo from one occasion trains you to recognise a photograph, not a face — a
          well-replicated finding, and the reason this app counts distinct encounters rather than
          photo count. Add another look next time you see them.
        </Evidence>
      </div>

      <button
        className="full ghost"
        aria-expanded={showContext}
        onClick={() => setShowContext((s) => !s)}
      >
        {showContext ? 'Hide conditions' : 'Log the conditions (optional)'}
      </button>

      {showContext && (
        <div className="card" style={{ marginBlockStart: 'var(--s-3)' }}>
          <p className="record-note" style={{ marginBlockStart: 0 }}>
            These are the confounds. Logging them is what later turns “I’m bad with names” into
            “I’m bad with names in loud rooms”, which is a different and far more fixable problem.
          </p>
          <div className="field" style={{ marginBlockStart: 'var(--s-4)' }}>
            <label>Noise</label>
            <Chips
              value={noise}
              onChange={setNoise}
              label="Noise"
              options={[
                { value: 'QUIET', label: 'Quiet' },
                { value: 'MODERATE', label: 'Some' },
                { value: 'LOUD', label: 'Loud' },
              ]}
            />
          </div>
          <div className="field">
            <label htmlFor="fatigue">
              Tiredness <span className="fig">{fatigue}/5</span>
            </label>
            <input id="fatigue" type="range" min={1} max={5} value={fatigue} onChange={(e) => setFatigue(+e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="stress">
              Stress <span className="fig">{stress}/5</span>
            </label>
            <input id="stress" type="range" min={1} max={5} value={stress} onChange={(e) => setStress(+e.target.value)} />
          </div>
          <div className="chips">
            <button
              type="button"
              className={`chip${alcohol ? ' on' : ''}`}
              aria-pressed={alcohol}
              onClick={() => setAlcohol((a) => !a)}
            >
              Drinking
            </button>
          </div>
        </div>
      )}

      <div className="spacer" />
      <button className="primary full" disabled={!canSave} onClick={() => void save()}>
        Capture
      </button>
      <p className="record-note">
        Stored on this device only. Nothing is uploaded, because there is nowhere to upload it to.
      </p>
    </>
  )
}
