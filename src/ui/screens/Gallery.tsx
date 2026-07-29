import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../state/store'
import type { Person, ScheduleItem } from '../../domain/types'
import { formatInterval } from '../../domain/time'
import {
  PASSES_ALLOWED,
  galleryAvailability,
  gradeForClaim,
  holdMsFor,
  ladderHz,
  planRun,
  rootHzForDay,
  ruleFraction,
  type Claim,
  type RoomPlan,
} from '../../domain/gallery/run'
import { nextDrillImage } from '../../domain/faceVariety'
import { buildCue } from '../../domain/scheduler/cueLadder'
import { distinctIdentities } from '../../lib/bust/identity'
import { GalleryRenderer, webglAvailable, type BustInstance } from '../../lib/gl/renderer'
import { playConfirm, playMiss, playPass, playRailedStamp, playStamp, playTick, primeAudio, suspendAudio, type SfxLevel } from '../../lib/sfx'
import { useNow, usePrefersReducedMotion } from '../hooks'
import { Empty, Evidence, Header, PersonName } from '../components'

/**
 * THE LONG ROOM.
 *
 * A forward-only walk down a gallery at closing time. Sculpted strangers stand on plinths; among
 * them, cards for people you have actually met. You claim each one before you pass it — and you
 * are told nothing until the room ends, when they resolve one at a time.
 *
 * ── WHAT IS AND IS NOT BEING CLAIMED ─────────────────────────────────────────────────────────
 *
 * This mode is an ADHERENCE feature. The 3D crowd is staging: it exists for pacing and triage
 * load, and it is not a way of learning anyone's face. See `docs/09-the-long-room.md` for the
 * measured result that closed that door (Matthews et al. 2024, BF10 0.40 and 0.52 *for* the null).
 * Every retrieval here routes through the ordinary `grade()` call on an ordinary FACE_TO_NAME
 * item, so the app's recall numbers stay comparable to the plain Session and nothing here can
 * quietly inflate them.
 *
 * ── WHY THE CARDS ARE DOM AND THE CROWD IS CANVAS ────────────────────────────────────────────
 *
 * Canvas hit-testing cannot be made accessible; the only pattern that works is a parallel focusable
 * DOM layer. Rather than bolt one on beside the scene, the interactive layer simply *is* the DOM:
 * each card is a real `<button>`, positioned by projecting its world point to screen space. It is
 * keyboard-reachable, screen-reader-legible and typographically crisp for free, and the WebGL
 * layer is left doing the one job it is good at — being a room full of people.
 */

const NEAR_LEGIBLE = 6.5
const WALK_SPEED = 1.55 // metres/second
const CARD_X = 0.78
const CARD_Y = 2.05
const FOV = (52 * Math.PI) / 180

type Phase = 'brief' | 'walking' | 'cascade' | 'over'

interface Placed {
  item: ScheduleItem
  person: Person
  z: number
  side: -1 | 1
  /** Set the first frame the card crosses the legibility threshold. */
  legibleAt: number | null
  claim: Claim | null
}

function readPalette(el: HTMLElement) {
  const cs = getComputedStyle(el)
  const rgb = (name: string, fallback: [number, number, number]): [number, number, number] => {
    const v = cs.getPropertyValue(name).trim()
    const m = v.match(/^#?([0-9a-f]{6})$/i)
    if (!m) return fallback
    const n = parseInt(m[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const bg = rgb('--bg', [0.07, 0.06, 0.05])
  const accent = rgb('--accent-edge', [0.89, 0.55, 0.39])

  /**
   * The stone is derived from `--ink-3`, not from a surface colour, and that is the whole trick.
   *
   * Analytic NPR output is not automatically contrast-safe, and the naive choice — tint the busts
   * with `--surface-2` — produces near-white plaster on a near-white page in the light theme. The
   * crowd vanished. `--ink-3` is the one token guaranteed to clear 4.5:1 against the background in
   * *both* themes, so building the material out of it means the silhouette reads either way: dark
   * bronze in a bright room, pale marble in a dark one, and never a ghost.
   */
  const ink = rgb('--ink-3', [0.59, 0.55, 0.5])
  const scale = (k: number): [number, number, number] => [ink[0] * k, ink[1] * k, ink[2] * k]
  return {
    stone: scale(0.22),
    key: scale(0.95),
    fill: scale(0.3),
    rim: accent,
    fog: bg,
  }
}

export default function Gallery() {
  const state = useStore()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const reduced = usePrefersReducedMotion()

  const availability = useMemo(() => galleryAvailability(state.people), [state.people])
  const plan = useMemo(
    () => planRun(state.items, state.people, now, state.settings),
    [state.items, state.people, now, state.settings],
  )

  const [phase, setPhase] = useState<Phase>('brief')
  const [roomIndex, setRoomIndex] = useState(0)
  const [passes, setPasses] = useState(0)
  const [sfx, setSfx] = useState<SfxLevel>('off')
  const [paused, setPaused] = useState(false)
  const [railOut, setRailOut] = useState(false)
  const [tick, setTick] = useState(0)
  const [cascadeIndex, setCascadeIndex] = useState(0)
  const [runLog, setRunLog] = useState<{ name: string; grade: string }[]>([])

  const camZ = useRef(0)
  const roomStart = useRef(0)
  const placedRef = useRef<Placed[]>([])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<GalleryRenderer | null>(null)
  const frameRef = useRef(0)

  const room: RoomPlan | undefined = plan.rooms[roomIndex]
  const rootHz = useMemo(() => rootHzForDay(now), [now])

  const byId = useMemo(() => new Map(state.people.map((p) => [p.id, p])), [state.people])
  const itemById = useMemo(() => new Map(state.items.map((i) => [i.id, i])), [state.items])

  // ── Room setup ──────────────────────────────────────────────────────────────────────────────
  const buildRoom = useCallback(
    (r: RoomPlan) => {
      const placed: Placed[] = []
      r.itemIds.forEach((id, n) => {
        const item = itemById.get(id)
        const person = item ? byId.get(item.subjectId) : undefined
        if (!item || !person) return
        placed.push({
          item,
          person,
          // Spaced so windows overlap in the later rooms and not in the first — divided attention
          // arrives as a spatial fact rather than as a badge on a queue.
          z: -(7 + n * (r.windowMs / 1000) * WALK_SPEED * 1.25),
          side: n % 2 === 0 ? -1 : 1,
          legibleAt: null,
          claim: null,
        })
      })
      placedRef.current = placed
      camZ.current = 0
      roomStart.current = performance.now()
      setRailOut(false)
      setCascadeIndex(0)
    },
    [byId, itemById],
  )

  // ── The crowd ───────────────────────────────────────────────────────────────────────────────
  const crowd = useMemo<BustInstance[]>(() => {
    if (!room) return []
    const ids = distinctIdentities(room.bustSeed, room.busts)
    return ids.map((identity, i) => {
      const side = i % 2 === 0 ? -1 : 1
      // Two ranks per side, staggered in depth, so the corridor has a middle distance rather than
      // a near wall and a far nothing.
      const rank = Math.floor(i / 2)
      const depth = -(5.5 + rank * 3.4 + (i % 3) * 0.9)
      return {
        identity,
        lod: (i < 4 ? 0 : i < 10 ? 1 : 2) as 0 | 1 | 2,
        // Pushed out with depth so the near plinths frame the shot instead of filling it.
        x: side * (1.5 + rank * 0.1 + (i % 3) * 0.08),
        y: 1.1 + (i % 3) * 0.09,
        z: depth,
        scale: 0.62,
        // Turned only slightly inward. A bust in three-quarter view still reads as a face; one
        // turned side-on reads as an egg, which is what the first pass looked like.
        yaw: side * (0.06 + (i % 5) * 0.03),
        accent: 0,
      }
    })
  }, [room])

  // ── WebGL lifecycle ─────────────────────────────────────────────────────────────────────────
  const has3D = useMemo(() => webglAvailable() && !reduced, [reduced])

  useEffect(() => {
    if (!has3D || phase === 'brief' || phase === 'over') return
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: GalleryRenderer
    try {
      renderer = new GalleryRenderer(canvas)
    } catch {
      return
    }
    rendererRef.current = renderer
    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [has3D, phase])

  /**
   * Draw the crowd once, from wherever the camera currently is.
   *
   * Separated from the walk loop on purpose. `requestAnimationFrame` does not fire in a hidden or
   * non-compositing tab, and it is not running at all while paused — so a room entered in either
   * state would render as a black rectangle with buttons floating on it. The scene is a still life
   * that happens to move; it must be drawable without the loop.
   */
  const drawScene = useCallback(() => {
    const renderer = rendererRef.current
    const canvas = canvasRef.current
    if (!renderer || !canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    renderer.resize(rect.width, rect.height)
    renderer.render(
      crowd,
      [0, 1.55, camZ.current],
      [0, 1.42, camZ.current - 4],
      readPalette(document.documentElement),
      6,
      26,
    )
  }, [crowd])

  // A still frame on entry, on pause, and on any theme or crowd change.
  useEffect(() => {
    if (phase === 'brief' || phase === 'over') return
    drawScene()
  }, [phase, paused, drawScene])

  // ── The walk ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'walking' || paused) return
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      if (!reduced) camZ.current -= WALK_SPEED * dt

      const placed = placedRef.current
      let newPasses = 0
      for (const p of placed) {
        const rel = camZ.current - p.z
        if (p.legibleAt === null && rel < NEAR_LEGIBLE && rel > 0) p.legibleAt = t
        // Behind the shoulder: gone, and gone is directional rather than a state change.
        if (p.claim === null && rel <= 0) {
          p.claim = { itemId: p.item.id, subjectId: p.person.id, kind: 'PASSED', latencyMs: 0, dividedAttention: false }
          newPasses += 1
          playPass(sfx)
        }
      }
      if (newPasses) setPasses((n) => n + newPasses)

      drawScene()
      setTick((n) => n + 1)

      const allResolved = placed.length > 0 && placed.every((p) => p.claim !== null)
      const walkedOut = placed.length === 0 || camZ.current < Math.min(...placed.map((p) => p.z)) - 2
      if (allResolved || walkedOut) {
        setPhase('cascade')
        return
      }
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [phase, paused, reduced, sfx, drawScene])

  // Stop the loop when the tab is hidden, and stop audio with it.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setPaused(true)
        suspendAudio()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // ── Claiming ────────────────────────────────────────────────────────────────────────────────
  const claim = useCallback(
    (p: Placed, kind: 'COLD' | 'RAILED') => {
      if (p.claim) return
      primeAudio()
      const legible = p.legibleAt ?? performance.now()
      const others = placedRef.current.filter(
        (q) => q !== p && q.claim === null && q.legibleAt !== null,
      ).length
      p.claim = {
        itemId: p.item.id,
        subjectId: p.person.id,
        kind,
        latencyMs: Math.max(0, Math.round(performance.now() - legible)),
        dividedAttention: others > 0,
      }
      if (kind === 'COLD') playStamp(sfx)
      else playRailedStamp(sfx)
      setTick((n) => n + 1)
    },
    [sfx],
  )

  // ── The cascade ─────────────────────────────────────────────────────────────────────────────
  const cascadeQueue = useMemo(
    () => (phase === 'cascade' ? placedRef.current.filter((p) => p.claim && p.claim.kind !== 'PASSED') : []),
    [phase, tick],
  )
  const current = cascadeQueue[cascadeIndex]

  const resolve = useCallback(
    async (held: boolean) => {
      if (!current?.claim) return
      const grade = gradeForClaim(current.claim, held)
      if (grade) {
        await state.grade(
          current.item.id,
          grade,
          current.claim.latencyMs,
          current.claim.kind === 'RAILED' ? 'FOUR_CHOICE' : 'FREE',
          current.claim.dividedAttention,
          Date.now(),
        )
        setRunLog((l) => [...l, { name: current.person.displayName, grade }])
        if (grade === 'MISS') playMiss(sfx)
        else playConfirm(sfx, ladderHz(rootHz, cascadeIndex))
      }
      if (cascadeIndex + 1 < cascadeQueue.length) {
        setCascadeIndex((i) => i + 1)
      } else if (roomIndex + 1 < plan.rooms.length && passes < PASSES_ALLOWED) {
        const next = plan.rooms[roomIndex + 1]
        setRoomIndex(roomIndex + 1)
        buildRoom(next)
        setPhase('walking')
      } else {
        setPhase('over')
      }
    },
    [current, cascadeIndex, cascadeQueue.length, roomIndex, plan.rooms, passes, state, sfx, rootHz, buildRoom],
  )

  // ── Keyboard ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'walking') return
    const onKey = (e: KeyboardEvent) => {
      const open = placedRef.current.filter((p) => !p.claim && p.legibleAt !== null)
      if (e.key === 'r' || e.key === 'R') {
        setRailOut((v) => !v)
        playTick(sfx)
      } else if (e.key === ' ' && open[0]) {
        e.preventDefault()
        claim(open[0], railOut ? 'RAILED' : 'COLD')
      } else if (/^[1-9]$/.test(e.key) && open[Number(e.key) - 1]) {
        claim(open[Number(e.key) - 1], railOut ? 'RAILED' : 'COLD')
      } else if (e.key === 'Escape') {
        setPaused((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, claim, railOut, sfx])

  // ── Screens ─────────────────────────────────────────────────────────────────────────────────

  if (!availability.available) {
    return (
      <>
        <Header title="The Long Room" back="/today" />
        <Empty
          title="Not yet a room"
          body={availability.reason}
          action={
            <button className="primary" onClick={() => navigate('/capture')}>
              Capture someone
            </button>
          }
        />
        <Evidence>
          The crowd is staging, not teaching. Sculpted heads are strangers to walk past — they are
          not a way of learning anyone&rsquo;s face, and this app will not pretend otherwise.
        </Evidence>
      </>
    )
  }

  if (plan.rooms.length === 0 && phase === 'brief') {
    return (
      <>
        <Header title="The Long Room" back="/today" />
        <Empty
          title="Nothing is due"
          body="The corridor is as long as what you actually owe, and tonight you owe nothing. It will be longer tomorrow."
          action={
            <button className="primary" onClick={() => navigate('/today')}>
              Done
            </button>
          }
        />
      </>
    )
  }

  if (phase === 'brief') {
    const boss = plan.bossItemId ? itemById.get(plan.bossItemId) : undefined
    const bossPerson = boss ? byId.get(boss.subjectId) : undefined
    return (
      <>
        <Header title="The Long Room" back="/today" sub="closing time" />
        <p className="lede">
          <span className="fig">{plan.rooms.length}</span> rooms.{' '}
          <span className="fig">{plan.totalTargets}</span> people you have met, standing among
          strangers. Claim each one before you pass them.
        </p>

        {bossPerson && (
          <div className="card">
            <span className="retrieval__mode">at the end</span>
            <p style={{ margin: 'var(--s-2) 0 0', fontSize: 'var(--t-lede)', lineHeight: 'var(--lh-lede)' }}>
              <PersonName person={bossPerson} />
              {plan.bossDaysOverdue > 0 ? (
                <>
                  {' '}— <span className="fig">{plan.bossDaysOverdue}</span> day
                  {plan.bossDaysOverdue === 1 ? '' : 's'} past due, and the one you are closest to
                  losing.
                </>
              ) : (
                <> — the one you are closest to losing.</>
              )}
            </p>
            <p className="record-note">
              You will not see them until the last room, and when you get there everything else is
              taken away: no crowd, no window, no rail.
            </p>
          </div>
        )}

        <h2>How it works</h2>
        <ul className="small muted" style={{ paddingInlineStart: 'var(--s-5)' }}>
          <li>Tap a card to claim it. Nothing is revealed — you find out at the end of the room.</li>
          <li>
            Pull the rail if you need the names in front of you. It is fast, and it is recorded as a
            tip-of-the-tongue, which this app already counts as a miss.
          </li>
          <li>
            Being wrong never ends the run. Only letting <span className="fig">{PASSES_ALLOWED}</span>{' '}
            people walk past unattended does.
          </li>
        </ul>
        <p className="record-note">
          Claiming blind is not blocked and is not punished — it simply resolves to a miss, drops
          the item two rungs, and makes tomorrow&rsquo;s queue longer. The cost is real and it is in
          the schedule, not in a score.
        </p>

        <div className="row" style={{ marginBlockStart: 'var(--s-5)' }}>
          <button
            className="primary grow btn--lg"
            onClick={() => {
              primeAudio()
              buildRoom(plan.rooms[0])
              setPhase('walking')
            }}
          >
            Go in
          </button>
        </div>

        <h2>Sound</h2>
        <div className="chips">
          {(['off', 'minimal', 'full'] as const).map((l) => (
            <button
              key={l}
              className={`chip${sfx === l ? ' on' : ''}`}
              aria-pressed={sfx === l}
              onClick={() => {
                setSfx(l)
                if (l !== 'off') primeAudio()
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <Evidence>
          The room is staging. Sculpted heads are the crowd you walk past, not faces to learn —
          synthesised viewpoint variation of a single identity was tested directly against one
          static image and returned Bayes factors of 0.40 and 0.52 in favour of no difference. What
          is measured here is the same retrieval the plain session measures, on the same items.
        </Evidence>
      </>
    )
  }

  if (phase === 'over') {
    const held = runLog.filter((r) => r.grade === 'GOT' || r.grade === 'INSTANT').length
    return (
      <>
        <Header title="The Long Room" back="/today" />
        <h2>The door</h2>
        <p className="lede">
          <span className="fig">{runLog.length}</span> retrieved,{' '}
          <span className="fig">{held}</span> cold.{' '}
          {passes > 0 && (
            <>
              <span className="fig">{passes}</span> walked past — those are still in your queue,
              untouched.
            </>
          )}
        </p>
        {runLog.length === 0 && (
          <p className="record-note">
            Nothing was claimed, so nothing was written. A run you walk out of costs you nothing.
          </p>
        )}
        <div>
          {runLog.map((r, i) => (
            <div key={i} className="row between row-rule" style={{ paddingBlock: 'var(--s-3)' }}>
              <span className="person-name">{r.name}</span>
              <span className="pill">{r.grade.toLowerCase()}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginBlockStart: 'var(--s-5)' }}>
          <button className="primary grow" onClick={() => navigate('/today')}>
            Done
          </button>
        </div>
      </>
    )
  }

  // ── The corridor ────────────────────────────────────────────────────────────────────────────
  const placed = placedRef.current
  const openCards = placed.filter((p) => !p.claim && p.legibleAt !== null)
  const railNames = room
    ? buildCue('FOUR_CHOICE', openCards[0]?.person.givenName ?? '', {
        distractors: state.people
          .filter((p) => p.track === 'PERSON' && !placed.some((q) => q.person.id === p.id))
          .map((p) => p.givenName),
      }).choices ?? []
    : []

  return (
    <div className="room" data-phase={phase}>
      <h1 className="sr-only">The Long Room — room {roomIndex + 1}</h1>

      {/* The shortening rule: the app's own structural atom used as the health bar. No number, no
          colour, no counter — a rule that gets shorter is a true statement, and a meter that fills
          would be a charter violation. */}
      <span
        className="room__rule"
        style={{ ['--rule-frac' as string]: ruleFraction(passes) }}
        aria-hidden
      />
      <p className="sr-only" aria-live="polite">
        {PASSES_ALLOWED - passes} of {PASSES_ALLOWED} passes remaining
      </p>

      <div className="room__register">
        <span className="retrieval__mode">
          room {roomIndex + 1} · {placed.filter((p) => p.claim && p.claim.kind !== 'PASSED').length} claimed
        </span>
        <button className="ghost small" onClick={() => setPaused((v) => !v)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {phase === 'walking' && (
        <>
          <div className="room__stage">
            {has3D && <canvas ref={canvasRef} className="room__canvas" aria-hidden />}
            {placed.map((p) => {
              const rel = camZ.current - p.z
              if (p.claim || p.legibleAt === null || rel <= 0 || rel > NEAR_LEGIBLE + 3) return null
              // Straight-ahead camera, so the projection is two divisions rather than a matrix.
              const scale = Math.min(1.15, 2.4 / Math.max(0.6, rel))
              const px = (p.side * CARD_X) / (rel * Math.tan(FOV / 2))
              const py = (CARD_Y - 1.55) / (rel * Math.tan(FOV / 2))
              const elapsed = performance.now() - p.legibleAt
              // Quantised to eight steps so the window STEPS rather than drains. A smooth bar is
              // a meter, and a meter that empties is the urgency vocabulary the charter bans.
              const raw = Math.max(0, 1 - elapsed / (room?.windowMs ?? 4000))
              const remaining = Math.ceil(raw * 8) / 8
              return (
                <button
                  key={p.item.id}
                  className="plate"
                  style={{
                    left: `${50 + px * 42}%`,
                    top: `${46 - py * 42}%`,
                    transform: `translate(-50%,-50%) scale(${scale.toFixed(3)})`,
                    ['--plate-frac' as string]: remaining,
                  }}
                  onClick={() => claim(p, railOut ? 'RAILED' : 'COLD')}
                >
                  <PlateFace person={p.person} media={state.media} />
                  <span className="plate__rule" aria-hidden />
                  <span className="sr-only">
                    Claim the person you met at {p.person.context || 'an unrecorded setting'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="room__controls">
            <button
              className="full ghost"
              aria-pressed={railOut}
              onClick={() => {
                setRailOut((v) => !v)
                playTick(sfx)
              }}
            >
              {railOut ? 'Put the rail back' : 'Pull the rail'}
            </button>
            {railOut && (
              <>
                <div className="chips">
                  {railNames.map((n) => (
                    <span key={n} className="chip person-name">
                      {n}
                    </span>
                  ))}
                </div>
                <p className="record-note">
                  With the rail out, a claim is recorded as a tip-of-the-tongue rather than a
                  success. That is what it costs.
                </p>
              </>
            )}
          </div>
        </>
      )}

      {phase === 'cascade' && current && (
        <Cascade
          person={current.person}
          item={current.item}
          index={cascadeIndex}
          total={cascadeQueue.length}
          onResolve={resolve}
        />
      )}
    </div>
  )
}

/**
 * The prompt on a plate.
 *
 * A real photograph when there is one — never a sculpted stand-in, because a generated head is not
 * this person and training against one would be training the wrong face. When there is no
 * photograph the plate falls back to the logged context, exactly as the plain Session does, which
 * is an honest cue rather than an invented one.
 */
function PlateFace({ person, media }: { person: Person; media: Parameters<typeof nextDrillImage>[1] }) {
  const image = nextDrillImage(person, media, null)
  if (image) return <img className="plate__img" src={image.src} alt="" />
  return (
    <span className="plate__context">
      {person.context || 'no record of where'}
      {person.hook ? ` · ${person.hook}` : ''}
    </span>
  )
}

/**
 * The reveal, reused verbatim from the Session.
 *
 * The silence before it is proportional to the interval genuinely at stake — the only emphasis
 * channel the visual system leaves open, and one bound to a measured quantity rather than to a
 * flourish.
 */
function Cascade({
  person,
  item,
  index,
  total,
  onResolve,
}: {
  person: Person
  item: ScheduleItem
  index: number
  total: number
  onResolve: (held: boolean) => void
}) {
  const [revealed, setRevealed] = useState(false)
  const interval = item.lastReviewedAt ? Date.now() - item.lastReviewedAt : 0
  const hold = holdMsFor(interval)

  useEffect(() => {
    setRevealed(false)
    const id = setTimeout(() => setRevealed(true), hold)
    return () => clearTimeout(id)
  }, [person.id, hold])

  return (
    <section className="cascade">
      <div className="retrieval__register">
        <span className="retrieval__mode">the door</span>
        <span className="retrieval__count mono">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </div>

      <div className="answer" data-revealed={revealed ? 'true' : 'false'}>
        <span className="answer__rule" aria-hidden />
        <div className="answer__slot">
          <p className="answer__rest">held {formatInterval(interval)}</p>
          <div className="answer__set" aria-live="polite">
            {revealed && (
              <>
                <p className="answer__name">{person.displayName}</p>
                {person.hook && <p className="answer__hook">{person.hook}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {revealed && (
        <div className="row">
          <button className="grow btn--lg" onClick={() => onResolve(false)}>
            Didn&rsquo;t
          </button>
          <button className="primary grow btn--lg" onClick={() => onResolve(true)}>
            Had it
          </button>
        </div>
      )}
    </section>
  )
}
