import { useEffect, useRef, useState } from 'react'
import type { MediaRef, Person } from '../domain/types'
import { MAX_CLIP_MS, recordingSupported, startRecording, type ActiveRecording } from '../lib/record'
import { mediaSrc } from '../lib/media'
import { useStore } from '../state/store'
import { Evidence } from './components'

/**
 * The voice control.
 *
 * Press and HOLD. Not a toggle, and that is a consent decision rather than an interaction
 * preference: a toggle can be started and walked away from, and a recording of someone's voice
 * that outlives your attention is exactly the thing this app must not make easy. A clip exists
 * only while a finger is on the control, and it is capped at eight seconds regardless.
 *
 * Nothing here is silent. The control states that it is recording, the browser shows its own
 * indicator, and the microphone is released the instant the finger lifts.
 */
export function VoiceCapture({ person, media }: { person: Person; media: MediaRef[] }) {
  const state = useStore()
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const active = useRef<ActiveRecording | null>(null)
  const startedAt = useRef(0)

  const clips = media.filter((m) => m.personId === person.id && m.kind === 'AUDIO')
  const supported = recordingSupported()

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setElapsed(performance.now() - startedAt.current), 100)
    return () => clearInterval(id)
  }, [recording])

  // A recording must never outlive the screen it was started on.
  useEffect(() => () => active.current?.cancel(), [])

  async function begin() {
    if (!supported || recording) return
    setError(null)
    try {
      startedAt.current = performance.now()
      active.current = await startRecording(() => void end())
      setRecording(true)
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'The microphone was not allowed. Nothing was recorded.'
          : 'This browser could not start recording.',
      )
    }
  }

  async function end() {
    const handle = active.current
    if (!handle) return
    active.current = null
    setRecording(false)
    const clip = await handle.stop()
    // A tap rather than a hold produces a few milliseconds of nothing. Storing it would put an
    // unplayable item in the queue.
    if (clip.blob.size < 1024 || clip.durationMs < 400) {
      setError('That was too short to keep. Hold the button while they say their name.')
      return
    }
    await state.addVoiceClip(person.id, clip.blob, clip.durationMs, Date.now())
  }

  if (!state.settings.voiceCaptureEnabled) {
    return (
      <div className="card">
        <span className="retrieval__mode">voice</span>
        <p className="record-note">
          Voice capture is off. Turn it on in Settings if you want it — it is off by default because
          recording someone is a different act from photographing them, and it should be a decision
          you made rather than one you defaulted into.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row between">
        <span className="retrieval__mode">voice</span>
        {clips.length > 0 && (
          <span className="pill good">
            {clips.length} clip{clips.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {!supported ? (
        <p className="record-note">This browser cannot record audio, so voice is unavailable here.</p>
      ) : (
        <>
          <button
            className={`full btn--lg${recording ? ' primary' : ''}`}
            style={{ marginBlockStart: 'var(--s-3)' }}
            onPointerDown={() => void begin()}
            onPointerUp={() => void end()}
            onPointerLeave={() => void end()}
            // Keyboard equivalent: a hold is a pointer idiom, so space/enter get an explicit
            // down/up pair rather than being left unreachable.
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault()
                void begin()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') void end()
            }}
          >
            {recording
              ? `Recording — release to stop · ${(Math.min(elapsed, MAX_CLIP_MS) / 1000).toFixed(1)}s`
              : 'Hold to record their name'}
          </button>
          <p className="record-note" aria-live="polite">
            {recording
              ? 'Recording now. Release the moment they finish.'
              : `Held only while the button is down, and never longer than ${MAX_CLIP_MS / 1000} seconds.`}
          </p>
        </>
      )}

      {error && <p className="record-note">{error}</p>}

      {clips.length > 0 && (
        <div style={{ marginBlockStart: 'var(--s-4)' }}>
          {clips.map((c) => (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio key={c.id} controls src={mediaSrc(c)} style={{ inlineSize: '100%' }} />
          ))}
        </div>
      )}

      <Evidence>
        The left temporal pole is a heteromodal naming hub — it responds near-identically to faces
        and voices. Training the voice route adds a second way in when the face route stalls. The
        first clip you keep opens Voice → Name for this person and nobody else: consent is given one
        person at a time, so a phase advance never mints these across your roster.
      </Evidence>
    </div>
  )
}
