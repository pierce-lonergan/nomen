/** Pure time helpers. Every function takes an explicit timestamp; nothing reads the clock. */

export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** Local calendar day key, `YYYY-MM-DD`. Local — a day boundary is a human boundary. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ts: number, days: number): number {
  return ts + days * DAY
}

/** Days between two timestamps by calendar day, not by elapsed milliseconds. */
export function calendarDaysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY)
}

/**
 * The next pre-sleep consolidation slot at or after `now`.
 * If it is already past the hour, the slot is tonight only if we haven't crossed midnight;
 * otherwise it rolls to the following evening.
 */
export function nextPreSleep(now: number, preSleepHour: number): number {
  const d = new Date(now)
  const slot = new Date(now)
  slot.setHours(preSleepHour, 0, 0, 0)
  if (slot.getTime() <= now) {
    // Between the slot hour and midnight, "tonight" has passed — but if we're only just past it,
    // schedule 20 minutes out rather than losing a full day of consolidation.
    if (d.getHours() >= preSleepHour) return now + 20 * MINUTE
    slot.setDate(slot.getDate() + 1)
  }
  return slot.getTime()
}

/** Human-readable interval, used in the "held for …" competence feedback. */
export function formatInterval(ms: number): string {
  if (ms < MINUTE) return `${Math.round(ms / SECOND)}s`
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`
  const days = Math.round(ms / DAY)
  if (days < 14) return `${days}d`
  if (days < 60) return `${Math.round(days / 7)}w`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

/** Deterministic 0..1 hash of a string — used for schedule jitter that stays testable. */
export function stableUnitHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
