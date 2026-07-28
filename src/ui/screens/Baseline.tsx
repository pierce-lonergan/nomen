import { useMemo, useState } from 'react'
import { useStore } from '../../state/store'
import type { AssessmentResult } from '../../domain/types'
import { BASELINE_INSTRUMENTS, computeVerdict } from '../../domain/assessment/verdict'
import { ASSESSMENT_NAMES, faceParams, faceVariant, pick } from '../../lib/stimuli'
import { speakInNoise, speechAvailable } from '../../lib/audio'
import { SyntheticFace } from '../SyntheticFace'
import { Chips, Evidence, Header, Stat } from '../components'

/**
 * Phase 0 — baseline and rule-outs.
 *
 * The point is routing, not scoring: several *non-memory* factors produce name failure, and they
 * should be ruled out before the problem is attributed to memory at all. The verdict this produces
 * changes what Phase 1 emphasises.
 *
 * Items here are held out from training items on purpose. Measuring yourself on the material you
 * have been drilling tells you about the drilling, not about you.
 *
 * The four instruments are ruled registers, not four cards each shouting a primary button. Exactly
 * one action on this screen is primary — the next instrument the user has not sat yet — because
 * four competing calls to action is the same as none.
 */

/** Two-digit counters so the register never reflows between trial 9 and trial 10. */
const pad = (n: number) => String(n).padStart(2, '0')

export default function Baseline() {
  const state = useStore()
  const [running, setRunning] = useState<AssessmentResult['kind'] | null>(null)
  const done = new Set(state.assessments.map((a) => a.kind))
  const verdict = state.assessments.length > 0 ? computeVerdict(state.assessments) : null
  const next = BASELINE_INSTRUMENTS.find((i) => !done.has(i.kind))

  async function record(kind: AssessmentResult['kind'], score: number, n: number) {
    await state.recordAssessment({ id: `${kind}-${Date.now()}`, at: Date.now(), kind, score, n })
    setRunning(null)
  }

  if (running === 'FACE_NAME') return <FaceNameTest onDone={(s, n) => void record('FACE_NAME', s, n)} />
  if (running === 'FACE_INDIVIDUATION')
    return <IndividuationTest onDone={(s, n) => void record('FACE_INDIVIDUATION', s, n)} />
  if (running === 'NAME_IN_NOISE') return <NoiseTest onDone={(s, n) => void record('NAME_IN_NOISE', s, n)} />
  if (running === 'CONFOUND_SCREEN') return <ConfoundScreen onDone={(s, n) => void record('CONFOUND_SCREEN', s, n)} />

  return (
    <>
      <Header
        title="Baseline"
        sub="Four short instruments. They decide what you train first — which matters more than it sounds, because the four routes lead to genuinely different programmes."
        back="/program"
      />

      <h2>Instruments</h2>
      <div>
        {BASELINE_INSTRUMENTS.map((inst) => {
          const latest = state.assessments.filter((a) => a.kind === inst.kind).sort((a, b) => b.at - a.at)[0]
          const isDone = done.has(inst.kind)
          const isNext = next?.kind === inst.kind
          return (
            <div key={inst.kind} className="row-rule" style={{ paddingBlock: 'var(--s-5)' }}>
              <div className="row between">
                <h3 style={{ marginBlockEnd: 0 }}>{inst.label}</h3>
                {isDone && <span className="pill good">done</span>}
              </div>
              <p style={{ marginBlockStart: 'var(--s-2)' }}>{inst.blurb}</p>
              {/* Never sat is a refusal, not a blank: the dash holds the figure's slot so all four
                  registers stay the same shape whatever state they are in. */}
              <Stat
                label="Last result"
                value={latest ? String(Math.round(latest.score * 100)) : '—'}
                unit="%"
                n={latest ? latest.n : 0}
                insufficient={!latest}
              />
              <button
                className={isNext ? 'primary full' : 'full ghost'}
                style={{ marginBlockStart: 'var(--s-4)' }}
                onClick={() => setRunning(inst.kind)}
              >
                {isDone ? 'Re-test' : 'Start'}
              </button>
            </div>
          )
        })}
      </div>

      {verdict && (
        <>
          <h2>Your route</h2>
          {/* The sentence this whole phase exists to produce: the moment "I'm bad with names"
              becomes a specific, fixable problem. It gets the spot rule and the title size. */}
          <div className="card accent" style={{ paddingBlock: 'var(--s-5)' }}>
            <h3
              style={{
                fontSize: 'var(--t-title)',
                lineHeight: 'var(--lh-title)',
                letterSpacing: 'var(--ls-title)',
                marginBlockEnd: 'var(--s-3)',
              }}
            >
              {verdict.headline}
            </h3>
            <p>{verdict.reasoning}</p>
            <span className="retrieval__mode">what phase 1 emphasises</span>
            <ul style={{ margin: 'var(--s-2) 0 0', paddingInlineStart: 'var(--s-5)' }}>
              {verdict.emphasis.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            {verdict.flags.map((f) => (
              <p key={f} className="record-note">
                {f}
              </p>
            ))}
          </div>
        </>
      )}

      <Evidence>
        These are procedurally generated stimuli, held out from your own people. That makes them a
        routing instrument rather than a clinical assessment — synthetic faces are a weaker proxy
        for real face individuation than photographs would be. Re-test monthly and compare like with
        like; a validated instrument would be better and this app does not pretend to be one.
      </Evidence>
    </>
  )
}

/** Learn eight face–name pairs, sit through a distractor, then recall. The primary anchor. */
function FaceNameTest({ onDone }: { onDone: (score: number, n: number) => void }) {
  const seed = useMemo(() => `fn-${Date.now()}`, [])
  const names = useMemo(() => pick(ASSESSMENT_NAMES, 8, seed), [seed])
  const [stage, setStage] = useState<'STUDY' | 'DISTRACT' | 'TEST' | 'RESULT'>('STUDY')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [countdown, setCountdown] = useState(30)

  if (stage === 'STUDY') {
    const name = names[index]
    return (
      <>
        <Header title="Learn" sub="Run the protocol on these too: look, say it aloud, make one hook." />
        {/* The assessment stimuli are human names, so they wear the serif at name size exactly as
            a real person in the session does. The face plate sits flush left on the 16px rule. */}
        <section className="retrieval">
          <div className="retrieval__register">
            <span className="retrieval__mode">face → name</span>
            <span className="retrieval__count mono">
              {pad(index + 1)} / {pad(names.length)}
            </span>
          </div>
          <SyntheticFace params={faceParams(name)} size={180} />
          <p className="answer__name">{name}</p>
        </section>
        <button
          className="primary full btn--lg"
          onClick={() => {
            if (index === names.length - 1) {
              setStage('DISTRACT')
              const id = setInterval(() => {
                setCountdown((c) => {
                  if (c <= 1) {
                    clearInterval(id)
                    setStage('TEST')
                    return 0
                  }
                  return c - 1
                })
              }, 1000)
            } else setIndex((i) => i + 1)
          }}
        >
          Next
        </button>
      </>
    )
  }

  if (stage === 'DISTRACT') {
    return (
      <>
        <Header title="Wait" sub="A filled delay, so this measures retrieval rather than what is still echoing in your head." />
        <div className="card">
          <Stat label="Until recall" value={String(countdown)} unit="s" />
          <p className="record-note">Count backwards from 100 in sevens until this reaches zero.</p>
        </div>
      </>
    )
  }

  if (stage === 'TEST') {
    const name = names[index]
    return (
      <>
        <Header title="Recall" />
        <section className="retrieval">
          <div className="retrieval__register">
            <span className="retrieval__mode">face → name</span>
            <span className="retrieval__count mono">
              {pad(index + 1)} / {pad(names.length)}
            </span>
          </div>
          <SyntheticFace params={faceParams(name)} size={180} />
        </section>
        <div className="field">
          <label htmlFor="answer">Their name</label>
          <input id="answer" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus autoComplete="off" />
        </div>
        <button
          className="primary full"
          onClick={() => {
            const next = [...answers, current.trim()]
            setAnswers(next)
            setCurrent('')
            if (index === names.length - 1) setStage('RESULT')
            else setIndex((i) => i + 1)
          }}
        >
          {index === names.length - 1 ? 'Finish' : 'Next'}
        </button>
      </>
    )
  }

  const correct = answers.filter((a, i) => a.toLowerCase() === names[i].toLowerCase()).length
  return (
    <>
      <Header title="Result" />
      <div className="card">
        <Stat label="Recalled" value={String(correct)} n={names.length} />
      </div>

      <h2>Item by item</h2>
      <div className="card">
        {names.map((n, i) => {
          const got = answers[i]?.toLowerCase() === n.toLowerCase()
          return (
            <div key={n} className="stat">
              <div className="stat__label">
                {/* A stimulus name is still a person's name. */}
                <span
                  className="stat__name person-name"
                  style={{ fontSize: 'var(--t-body)', lineHeight: 'var(--lh-body)' }}
                >
                  {n}
                </span>
                <span className="stat__hint">you wrote {answers[i] ? `“${answers[i]}”` : 'nothing'}</span>
              </div>
              <div className="stat__read">
                {/* State is a border and a word. A miss is the instrument working, not a fault,
                    so it is never coloured. */}
                <span className={got ? 'pill good' : 'pill'}>{got ? 'correct' : 'missed'}</span>
              </div>
            </div>
          )
        })}
      </div>
      <button className="primary full" onClick={() => onDone(correct / names.length, names.length)}>
        Save result
      </button>
    </>
  )
}

/** Match-to-sample across image variants — the face side of the binding. */
function IndividuationTest({ onDone }: { onDone: (score: number, n: number) => void }) {
  const seed = useMemo(() => `ind-${Date.now()}`, [])
  const trials = 8
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)

  const targetName = pick(ASSESSMENT_NAMES, trials, seed)[index]
  const foils = pick(
    ASSESSMENT_NAMES.filter((n) => n !== targetName),
    3,
    `${seed}-${index}`,
  )
  const targetIdx = index % 4
  const options = [...foils]
  options.splice(targetIdx, 0, targetName)

  if (index >= trials) {
    return (
      <>
        <Header title="Result" />
        <div className="card">
          <Stat label="Matched" value={String(correct)} n={trials} />
          <p>
            Below about two-thirds here means faces are the weak side of your binding — you cannot
            attach a name to a face you did not encode distinctly, so face work comes first.
          </p>
        </div>
        <button className="primary full" onClick={() => onDone(correct / trials, trials)}>
          Save result
        </button>
      </>
    )
  }

  return (
    <>
      <Header title="Match" sub="Which of these is the same person, shown differently?" />
      <section className="retrieval">
        <div className="retrieval__register">
          <span className="retrieval__mode">same person</span>
          <span className="retrieval__count mono">
            {pad(index + 1)} / {pad(trials)}
          </span>
        </div>
        <SyntheticFace params={faceParams(targetName)} size={150} />
        <div className="row wrap">
          {options.map((name, i) => (
            <button
              key={`${name}-${i}`}
              style={{ padding: 'var(--s-1)' }}
              onClick={() => {
                if (i === targetIdx) setCorrect((c) => c + 1)
                setIndex((n) => n + 1)
              }}
            >
              <SyntheticFace params={faceVariant(faceParams(name), index + 1)} size={100} />
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

/** Names spoken over babble. Separates hearing the name from remembering it. */
function NoiseTest({ onDone }: { onDone: (score: number, n: number) => void }) {
  const seed = useMemo(() => `noise-${Date.now()}`, [])
  const trials = 8
  const names = useMemo(() => pick(ASSESSMENT_NAMES, trials, seed), [seed])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [correct, setCorrect] = useState(0)
  const [played, setPlayed] = useState(false)

  if (!speechAvailable()) {
    return (
      <>
        <Header title="Names in noise" back="/baseline" />
        <div className="card">
          <p>
            This browser has no speech synthesis, so this instrument cannot run here. It is the one
            test that needs it — everything else works offline without audio.
          </p>
          <p className="record-note">
            If your name failures cluster in bars and parties, treat that pattern as evidence in its
            own right: it points at hearing the name rather than remembering it.
          </p>
        </div>
      </>
    )
  }

  if (index >= trials) {
    return (
      <>
        <Header title="Result" />
        <div className="card">
          <Stat label="Heard correctly" value={String(correct)} n={trials} />
          <p>
            A low score here is not a memory result. Proper names are low-frequency and carry no
            semantic redundancy, so when they are masked there is nothing for your brain to repair
            them with — the name is often never accurately perceived at all.
          </p>
        </div>
        <button className="primary full" onClick={() => onDone(correct / trials, trials)}>
          Save result
        </button>
      </>
    )
  }

  // Noise rises across trials so the test finds a threshold rather than a ceiling.
  const noiseGain = 0.05 + index * 0.035

  return (
    <>
      <Header title="Listen" sub="Play it once, then type what you heard. Guessing is fine." />
      <section className="retrieval">
        <div className="retrieval__register">
          <span className="retrieval__mode">voice → name</span>
          <span className="retrieval__count mono">
            {pad(index + 1)} / {pad(trials)}
          </span>
        </div>
        <div>
          <button
            className="primary"
            onClick={() => {
              speakInNoise(names[index], noiseGain)
              setPlayed(true)
            }}
          >
            {played ? 'Play again' : 'Play'}
          </button>
          <p className="dim" style={{ marginBlockStart: 'var(--s-3)' }}>
            background level <span className="fig">{Math.round(noiseGain * 100)}</span>%
          </p>
        </div>
      </section>
      <div className="field">
        <label htmlFor="heard">What did you hear?</label>
        <input id="heard" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" />
      </div>
      <button
        className="full"
        disabled={!played}
        onClick={() => {
          if (answer.trim().toLowerCase() === names[index].toLowerCase()) setCorrect((c) => c + 1)
          setAnswer('')
          setPlayed(false)
          setIndex((i) => i + 1)
        }}
      >
        Next
      </button>
    </>
  )
}

const SCREEN_QUESTIONS = [
  { id: 'sleep', text: 'I regularly get less sleep than I need.' },
  { id: 'noise', text: 'My name failures happen mostly in loud places.' },
  { id: 'alcohol', text: 'I often meet new people while drinking.' },
  { id: 'stress', text: 'Introductions make me tense or self-conscious.' },
  { id: 'attention', text: 'My attention wanders during introductions.' },
  { id: 'hearing', text: 'I ask people to repeat themselves in busy rooms.' },
]

const FREQUENCY: { value: string; label: string }[] = [
  { value: '0', label: 'Never' },
  { value: '1', label: 'Rarely' },
  { value: '2', label: 'Sometimes' },
  { value: '3', label: 'Often' },
  { value: '4', label: 'Always' },
]

function ConfoundScreen({ onDone }: { onDone: (score: number, n: number) => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const complete = SCREEN_QUESTIONS.every((q) => answers[q.id] !== undefined)
  const risk =
    SCREEN_QUESTIONS.reduce((s, q) => s + (answers[q.id] ?? 0), 0) / (SCREEN_QUESTIONS.length * 4)

  return (
    <>
      <Header
        title="Context screener"
        sub="Not a diagnosis. These are the ordinary, non-memory reasons a name fails to stick — worth ruling out before blaming your memory."
        back="/baseline"
      />
      {SCREEN_QUESTIONS.map((q) => (
        <div key={q.id} className="row-rule" style={{ paddingBlock: 'var(--s-4)' }}>
          <p>{q.text}</p>
          <Chips
            label={q.text}
            options={FREQUENCY}
            value={answers[q.id] === undefined ? '' : String(answers[q.id])}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
          />
        </div>
      ))}
      <button
        className="primary full"
        style={{ marginBlockStart: 'var(--s-5)' }}
        disabled={!complete}
        onClick={() => onDone(risk, SCREEN_QUESTIONS.length)}
      >
        Save
      </button>
    </>
  )
}
