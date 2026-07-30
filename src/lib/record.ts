/**
 * Voice capture.
 *
 * ── THE CONSENT PROBLEM, WHICH IS THE HARD PART ───────────────────────────────────────────────
 *
 * A photograph of someone taken at a party is a thing people broadly understand is happening. A
 * recording of their voice, taken without their knowledge, is a different act — and in a good
 * many jurisdictions a different act legally. This app's whole privacy posture is that the
 * database is full of other people's data and they never agreed to any of it, so voice is the one
 * capture where the app must not make it easy to be silent about it.
 *
 * Hence, enforced here rather than in copy:
 *   · Recording is opt-in globally (`settings.voiceCaptureEnabled`) AND per person.
 *   · There is no background, timed, or automatic recording anywhere. A clip only exists while a
 *     finger is on the control — release ends it. You cannot start one and walk away.
 *   · Clips are hard-capped at eight seconds. A name and a greeting is the use case; anything
 *     longer is a conversation, and the app has no business holding one.
 *   · The stream's tracks are stopped the moment recording ends, so the browser's recording
 *     indicator goes out immediately rather than lingering.
 *
 * Everything stays on the device, like everything else. There is no code path that uploads a clip
 * because there is nowhere for it to go.
 */

/** Eight seconds. A name, said clearly, twice. */
export const MAX_CLIP_MS = 8000

export function recordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

/**
 * The container the browser will actually give us.
 *
 * Codec support is genuinely divided: Chrome and Firefox do WebM/Opus, Safari does MP4/AAC and
 * will silently produce an unplayable file if handed a mimeType it does not support. Probing is
 * the only reliable route.
 */
function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t))
}

export interface Recording {
  blob: Blob
  durationMs: number
}

export interface ActiveRecording {
  /** Ends the clip and resolves with it. Safe to call twice. */
  stop: () => Promise<Recording>
  /** Throws the clip away and releases the microphone. */
  cancel: () => void
}

/**
 * Start recording. The caller holds the handle and must stop or cancel it.
 *
 * Rejects rather than resolving-with-null on a denied permission, so a refusal cannot be mistaken
 * for an empty clip.
 */
export async function startRecording(onAutoStop?: () => void): Promise<ActiveRecording> {
  if (!recordingSupported()) throw new Error('This browser cannot record audio.')

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  const startedAt = performance.now()
  let settled = false

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start()

  const release = () => {
    // Stop the tracks, not just the recorder. Leaving them live keeps the browser's recording
    // indicator lit, which on a feature about other people's consent is exactly the wrong signal.
    for (const track of stream.getTracks()) track.stop()
  }

  const hardStop = window.setTimeout(() => {
    if (recorder.state === 'recording') {
      recorder.stop()
      onAutoStop?.()
    }
  }, MAX_CLIP_MS)

  return {
    stop: () =>
      new Promise<Recording>((resolve) => {
        window.clearTimeout(hardStop)
        const finish = () => {
          if (settled) return
          settled = true
          release()
          resolve({
            blob: new Blob(chunks, { type: mimeType ?? 'audio/webm' }),
            durationMs: Math.min(MAX_CLIP_MS, Math.round(performance.now() - startedAt)),
          })
        }
        if (recorder.state === 'inactive') finish()
        else {
          recorder.onstop = finish
          recorder.stop()
        }
      }),
    cancel: () => {
      window.clearTimeout(hardStop)
      settled = true
      if (recorder.state !== 'inactive') recorder.stop()
      release()
    },
  }
}
