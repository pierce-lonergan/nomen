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
