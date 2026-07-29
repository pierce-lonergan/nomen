import { useEffect, useState } from 'react'

/**
 * A ticking clock for the view layer.
 *
 * The domain never reads the clock — every function takes `now` — so the UI is the only place
 * where time enters, and it enters here. The default 30s cadence is enough to move a 20-second
 * front-load retrieval into the queue without re-rendering constantly.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * The user's motion preference, live.
 *
 * The `change` listener is not optional. A media query read once at mount silently ignores anyone
 * who turns the preference on mid-session, and the Long Room renders a continuously moving camera
 * — exactly the case the preference exists for. Note also that this hook alone does not discharge
 * WCAG 2.2.2 for motion lasting over five seconds: most people never set the OS flag, so anything
 * using it must ALSO ship a visible, keyboard-reachable pause control.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** A fast clock for anything that counts down inside a single interaction. */
export function useTicker(active: boolean, intervalMs = 1000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return tick
}
