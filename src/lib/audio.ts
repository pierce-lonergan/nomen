/**
 * Audio for the name-in-noise instrument.
 *
 * Everything is synthesised locally: speech via the browser's own speech synthesis, masking via
 * generated noise. No audio files ship with the app and nothing is fetched at runtime.
 *
 * The mechanism being probed: low-frequency proper names carry no semantic redundancy, so when
 * they are masked the listener has nothing to repair them with. If names fail here but not in
 * quiet, the bottleneck is perception rather than memory — which is a completely different problem
 * with a completely different fix.
 */

let ctx: AudioContext | null = null

function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Speech-shaped babble: filtered noise centred on the frequencies that mask speech. */
export function playBabble(durationMs: number, gain: number): () => void {
  const ac = audioContext()
  const frames = Math.ceil((ac.sampleRate * durationMs) / 1000)
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1
    // Light low-pass gives the noise a speech-like spectral tilt rather than a hiss.
    last = 0.82 * last + 0.18 * white
    data[i] = last * 1.6
  }

  const source = ac.createBufferSource()
  source.buffer = buffer
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1200
  band.Q.value = 0.6
  const volume = ac.createGain()
  volume.gain.value = gain

  source.connect(band).connect(volume).connect(ac.destination)
  source.start()
  return () => {
    try {
      source.stop()
    } catch {
      // Already stopped — nothing to do.
    }
  }
}

export function speak(text: string, rate = 1): void {
  if (!speechAvailable()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = rate
  window.speechSynthesis.speak(utterance)
}

/** Speak a name over babble at a given signal-to-noise ratio. Returns a stop function. */
export function speakInNoise(name: string, noiseGain: number): () => void {
  const stop = playBabble(2600, noiseGain)
  window.setTimeout(() => speak(name), 350)
  window.setTimeout(stop, 2600)
  return stop
}
