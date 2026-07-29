/**
 * The Long Room's sound, synthesised from oscillators and noise. No audio files, no network, ever.
 *
 * ── THE ARITHMETIC RESTRAINT RULE ────────────────────────────────────────────────────────────
 *
 * Permitted intensity is inversely proportional to event frequency. A tick that fires two hundred
 * times a session gets 20ms at −26dBFS; a sound that fires once gets the full chime. This turns
 * "be tasteful" into something that can be applied without a designer in the room, and it is the
 * only defence against the failure mode that matters here: everything in this file is delightful
 * for fifty plays, and the app is used every night for a year. Repetition fatigue does not arrive
 * as a bug report — it arrives as a user muting the app permanently and never saying why.
 *
 * The acceptance test for every sound below is therefore **"does this still feel good the five
 * hundredth time, at 11pm, when tired"** — not "is this satisfying once".
 *
 * Consequences, all deliberate:
 *   · Audio ships OFF by default, with three states rather than a binary mute.
 *   · The error tone is 8dB *below* the success tone with a falling contour. A loud error sound is
 *     the single most reliable way to get an app silenced forever.
 *   · No riser. Risers manufacture anticipation, anticipation is a stress response, and in a tool
 *     used nightly that compounds badly.
 *   · Hard-muted in the pre-sleep slot regardless of setting.
 *   · Every tone has a structural equivalent on screen, so sound is never the sole carrier.
 */

export type SfxLevel = 'off' | 'minimal' | 'full'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let verb: ConvolverNode | null = null
let verbSend: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

/**
 * One context, created lazily on a user gesture.
 *
 * Contexts are capped per tab (historically ~6 in Chrome) and a leaked one fails silently rather
 * than throwing, so a hot-reloading dev session can exhaust them and produce a baffling "audio
 * just stopped" report. There is exactly one, and it is reused.
 */
function audio(): { ctx: AudioContext; master: GainNode; send: GainNode } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' })

    // The compressor stops a pile-up of overlapping chimes from clipping; the lowpass takes off
    // the brittle top edge that drives ear fatigue over a long session.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 4
    comp.attack.value = 0.003
    comp.release.value = 0.25

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 12000

    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(comp).connect(lp).connect(ctx.destination)

    // ONE shared reverb send, never per-voice. A ConvolverNode runs real FFT convolution on the
    // audio thread; eight of them firing at once during a cascade is an audible glitch.
    const frames = Math.floor(ctx.sampleRate * 1.1)
    const ir = ctx.createBuffer(2, frames, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = ir.getChannelData(c)
      const preDelay = Math.floor(ctx.sampleRate * 0.018)
      for (let i = preDelay; i < frames; i++) {
        const t = (i - preDelay) / (frames - preDelay)
        // Decorrelated noise with an exponential decay and a progressive HF rolloff along the tail.
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (1 - t * 0.5)
      }
    }
    verb = ctx.createConvolver()
    verb.buffer = ir
    verbSend = ctx.createGain()
    verbSend.gain.value = 0.1 // ≈ −20dB wet
    verbSend.connect(verb).connect(master)

    const nFrames = Math.floor(ctx.sampleRate * 2)
    noiseBuffer = ctx.createBuffer(1, nFrames, ctx.sampleRate)
    const nd = noiseBuffer.getChannelData(0)
    for (let i = 0; i < nFrames; i++) nd[i] = Math.random() * 2 - 1
  }
  // Audio created before a gesture starts suspended, so the first sound of a session is silently
  // swallowed unless this runs. Testers with an already-interacted page never see it.
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, master: master!, send: verbSend! }
}

/** Call from the first pointer/key event on the gallery screen. */
export function primeAudio(): void {
  audio()
}

export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend()
}

/** Exponential decay to a floor, which is what a struck object actually does. */
function decay(param: AudioParam, at: number, peak: number, attack: number, tau: number) {
  param.cancelScheduledValues(at)
  param.setValueAtTime(0.0001, at)
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack)
  param.exponentialRampToValueAtTime(0.0001, at + attack + tau)
}

interface ToneOpts {
  hz: number
  gain: number
  attack?: number
  tau?: number
  partials?: number[]
  type?: OscillatorType
  wet?: number
  at?: number
}

function tone({ hz, gain, attack = 0.004, tau = 0.5, partials = [1], type = 'sine', wet = 0.5, at }: ToneOpts) {
  const a = audio()
  if (!a) return
  const t = at ?? a.ctx.currentTime
  const bus = a.ctx.createGain()
  bus.gain.value = 1
  bus.connect(a.master)
  if (wet > 0) {
    const s = a.ctx.createGain()
    s.gain.value = wet
    bus.connect(s).connect(a.send)
  }

  partials.forEach((mult, i) => {
    const osc = a.ctx.createOscillator()
    osc.type = type
    // ±10% pitch jitter per event. Necessary but not sufficient against repetition fatigue — the
    // daily re-rooting of the scale is what actually carries that load.
    osc.frequency.value = hz * mult * (1 + (Math.random() - 0.5) * 0.02)
    const g = a.ctx.createGain()
    decay(g.gain, t, (gain * Math.pow(0.45, i)) as number, attack, tau)
    osc.connect(g).connect(bus)
    osc.start(t)
    osc.stop(t + attack + tau + 0.05)
  })
}

function noise(freq: number, q: number, gain: number, tau: number, at?: number, type: BiquadFilterType = 'bandpass') {
  const a = audio()
  if (!a || !noiseBuffer) return
  const t = at ?? a.ctx.currentTime
  const src = a.ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const f = a.ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = a.ctx.createGain()
  decay(g.gain, t, gain, 0.001, tau)
  src.connect(f).connect(g).connect(a.master)
  src.start(t)
  src.stop(t + tau + 0.05)
}

// ── The vocabulary ────────────────────────────────────────────────────────────────────────────

/**
 * THE STAMP — claiming a card. The one place the run spends its juice budget.
 *
 * Three layers under 120ms: a low sine thump for the body, a short filtered noise transient for
 * the air, and a tight click for the contact. It is the sound of a thing being set down, not of a
 * point being scored, which is the whole distinction this design rests on.
 */
export function playStamp(level: SfxLevel) {
  if (level === 'off') return
  tone({ hz: 90, gain: 0.5, attack: 0.002, tau: 0.1, partials: [1, 2, 3], wet: 0.15 })
  if (level === 'full') {
    noise(1800, 0.7, 0.09, 0.012)
    noise(3200, 2.5, 0.05, 0.004, undefined, 'highpass')
  }
}

/** A softer stamp: the card was claimed with the rail out, and it should not feel as good. */
export function playRailedStamp(level: SfxLevel) {
  if (level === 'off') return
  tone({ hz: 76, gain: 0.3, attack: 0.003, tau: 0.09, partials: [1, 2], wet: 0.12 })
}

/** The rail sliding out — 200×/session territory, so it gets almost nothing. */
export function playTick(level: SfxLevel) {
  if (level !== 'full') return
  noise(2400, 1.2, 0.03, 0.018)
}

/**
 * A confirmation in the cascade, at its step on the ladder.
 *
 * Scheduled against `currentTime + lookahead` rather than chained through setTimeout: main-thread
 * timer jitter is audible as sloppy rhythm, and sloppy rhythm undermines exactly the precision
 * that makes an ascending run satisfying.
 */
export function playConfirm(level: SfxLevel, hz: number, whenOffsetMs = 0) {
  if (level === 'off') return
  const a = audio()
  if (!a) return
  const at = a.ctx.currentTime + whenOffsetMs / 1000
  const partials = level === 'minimal' ? [1] : [1, 2, 3]
  tone({ hz, gain: 0.22, attack: 0.006, tau: 0.9, partials, wet: level === 'minimal' ? 0 : 0.6, at })
}

/**
 * A miss. Quieter than the confirmation by 8dB and falling rather than dissonant.
 *
 * Harshness here would be the fastest possible route to a permanently muted app, and a miss in
 * this domain is the architecture working as designed rather than a fault worth scolding.
 */
export function playMiss(level: SfxLevel, whenOffsetMs = 0) {
  if (level === 'off') return
  const a = audio()
  if (!a) return
  const at = a.ctx.currentTime + whenOffsetMs / 1000
  const osc = a.ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(330, at)
  osc.frequency.exponentialRampToValueAtTime(196, at + 0.34)
  const g = a.ctx.createGain()
  decay(g.gain, at, 0.088, 0.01, 0.36) // ≈ −8dB against playConfirm's 0.22
  osc.connect(g).connect(a.master)
  osc.start(at)
  osc.stop(at + 0.42)
}

/** Someone walked past unattended. A single dry, low, short thud — a door closing, not an alarm. */
export function playPass(level: SfxLevel) {
  if (level === 'off') return
  tone({ hz: 62, gain: 0.24, attack: 0.004, tau: 0.28, partials: [1, 1.5], wet: 0.2 })
}
