import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, type CaptureDraft } from '../../state/store'
import type { MeetAgainLikelihood, NoiseLevel, ProtocolAdherence } from '../../domain/types'
import { filesToDataUrls } from '../../lib/image'
import { Chips, Evidence, Header } from '../components'

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
  const [saved, setSaved] = useState<{ name: string; roster: boolean } | null>(null)
  const [showContext, setShowContext] = useState(false)

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
    setSaved({ name: person.displayName, roster: person.status === 'ROSTER' })
  }

  if (saved) {
    return (
      <>
        <Header title="Caught." sub={`${saved.name} is in.`} />
        <div className="card accent">
          <p>
            Your first check is in <strong>20 seconds</strong>. That one is meant to be easy — an
            expanding schedule only pays off if the first retrieval succeeds, so it is deliberately
            almost free.
          </p>
          {saved.roster && (
            <p className="small muted">
              You have already hit today’s intake cap, so {saved.name} is on the roster rather than in
              rotation. Nothing is lost — they come in tomorrow, highest-likelihood first.
            </p>
          )}
          <button className="primary full" onClick={() => navigate('/session')}>
            Go to the 20-second check
          </button>
        </div>
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
      <p className="small muted">
        Tap each one as you do it — not as an intention. Adherence is the metric that predicts
        everything downstream, and it only means something if it is honest.
      </p>
      {BEATS.map((beat) => (
        <button
          key={beat.key}
          type="button"
          className={`beat${adherence[beat.key] ? ' done' : ''}`}
          onClick={() => setAdherence((a) => ({ ...a, [beat.key]: !a[beat.key] }))}
        >
          <span className="beat-key">{beat.label}</span>
          <span className="grow small">{beat.instruction}</span>
          <span aria-hidden>{adherence[beat.key] ? '✓' : '○'}</span>
        </button>
      ))}

      <h2>Details</h2>
      <div className="field">
        <label htmlFor="hook">Hook — one association</label>
        <input
          id="hook"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="architect, sails at weekends"
        />
        <div className="dim" style={{ marginTop: 4 }}>
          Semantic and biographical, not appearance. A name is a dead-end label until you connect it
          to something — that is the whole Baker/baker problem.
        </div>
      </div>

      <div className="field">
        <label htmlFor="phonetic">How it sounds</label>
        <input
          id="phonetic"
          value={phonetic}
          onChange={(e) => setPhonetic(e.target.value)}
          placeholder="SAH-ra, not SARE-a"
        />
        <div className="dim" style={{ marginTop: 4 }}>
          Asking for the spelling or origin buys you a second clear hearing and a semantic hook in
          one move. It is the mechanically justified thing to do, not just the polite one.
        </div>
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
          options={[
            { value: 'HIGH', label: 'Often' },
            { value: 'MEDIUM', label: 'Maybe' },
            { value: 'LOW', label: 'Probably not' },
          ]}
        />
        <div className="dim" style={{ marginTop: 4 }}>
          This drives triage. When the queue is over capacity, the people you will actually see come
          first — a scheduler for people can do that, and a scheduler for flashcards cannot.
        </div>
      </div>

      <div className="field">
        <label htmlFor="photo">Photo (optional)</label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          multiple
          onChange={async (e) => setImages(await filesToDataUrls(e.target.files))}
        />
        {images.length > 0 && (
          <div className="row wrap" style={{ marginTop: 8 }}>
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

      <button className="full ghost" onClick={() => setShowContext((s) => !s)}>
        {showContext ? 'Hide conditions' : 'Log the conditions (optional)'}
      </button>

      {showContext && (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="small muted">
            These are the confounds. Logging them is what later turns “I’m bad with names” into
            “I’m bad with names in loud rooms”, which is a different and far more fixable problem.
          </p>
          <div className="field">
            <label>Noise</label>
            <Chips
              value={noise}
              onChange={setNoise}
              options={[
                { value: 'QUIET', label: 'Quiet' },
                { value: 'MODERATE', label: 'Some' },
                { value: 'LOUD', label: 'Loud' },
              ]}
            />
          </div>
          <div className="field">
            <label htmlFor="fatigue">Tiredness: {fatigue}/5</label>
            <input id="fatigue" type="range" min={1} max={5} value={fatigue} onChange={(e) => setFatigue(+e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="stress">Stress: {stress}/5</label>
            <input id="stress" type="range" min={1} max={5} value={stress} onChange={(e) => setStress(+e.target.value)} />
          </div>
          <button className={`chip${alcohol ? ' on' : ''}`} onClick={() => setAlcohol((a) => !a)}>
            Drinking
          </button>
        </div>
      )}

      <div className="spacer" />
      <button className="primary full" disabled={!canSave} onClick={() => void save()}>
        Capture
      </button>
      <div className="dim center" style={{ marginTop: 8 }}>
        Stored on this device only. Nothing is uploaded, because there is nowhere to upload it to.
      </div>
    </>
  )
}
