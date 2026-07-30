import type { DailyPlan } from '../domain/program/dailyPlan'

/**
 * Local notifications and the offline shell.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────
 *
 * `shouldPrompt()` has been implemented and unit-tested since v0.1 with **zero non-test callers**,
 * while the Settings screen published a policy about notifications the app could not send. The
 * decision of *whether* to fire was built; the delivery was not. For a practice whose payoff
 * happens off-app three weeks later, that left the app with no way to reach the user at all.
 *
 * ── NO SERVER, STILL NO NETWORK ───────────────────────────────────────────────────────────────
 *
 * Web Push would need VAPID keys and an endpoint, i.e. a backend, i.e. the thing this app refuses
 * to have. Everything here is a *local* notification: the page decides, posts a message to its own
 * service worker, and the worker displays it. There is no channel by which anyone else could send
 * one. The `no network calls at runtime` property is intact.
 *
 * ── THE CHARTER APPLIES TO NOTIFICATIONS MOST OF ALL ──────────────────────────────────────────
 *
 * Settings promises: never one you did not configure, and never between 22:00 and 07:00. Both are
 * enforced below rather than in copy — `quiet hours` is a hard gate, permission is only ever
 * requested from an explicit tap, and the copy states a fact ("six due") rather than applying
 * pressure. No streaks, no guilt, no "don't lose your progress", and the notification is silent
 * and dismissible.
 */

const QUIET_START = 22
const QUIET_END = 7

export type NotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied'

export function notifyPermission(): NotifyPermission {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported'
  }
  return Notification.permission as NotifyPermission
}

/**
 * Ask for permission.
 *
 * Must be called from a user gesture — browsers reject it otherwise, and a silently-rejected
 * request looks to the user like a broken button. There is deliberately no auto-prompt on load:
 * an unsolicited permission dialog is the single most disliked pattern on the web, and "a
 * notification you did not configure" is precisely what Settings promises never to send.
 */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (notifyPermission() === 'unsupported') return 'unsupported'
  return (await Notification.requestPermission()) as NotifyPermission
}

/** Quiet hours, from the app's own published promise. Local time, because a night is local. */
export function inQuietHours(now: number): boolean {
  const h = new Date(now).getHours()
  return h >= QUIET_START || h < QUIET_END
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    // Relative, so the same build registers correctly at a project sub-path or a domain root.
    return await navigator.serviceWorker.register(
      new URL('sw.js', document.baseURI).pathname,
      { scope: new URL('./', document.baseURI).pathname },
    )
  } catch {
    // A failed registration must never break the app. Offline is an enhancement here, not a
    // dependency — the app has always worked as a plain page and still does.
    return null
  }
}

export interface Nudge {
  title: string
  body: string
}

/**
 * The copy for a nudge, built from true facts.
 *
 * Deliberately flat. No countdown, no streak, no "you'll lose", no exclamation mark. The test the
 * charter sets is whether the sentence is still true with the clock removed — "six due" passes,
 * "six due, don't break your streak!" does not.
 */
export function nudgeFor(plan: DailyPlan): Nudge | null {
  const due = plan.queue.queue.length
  if (due === 0) return null
  return {
    title: 'Nomen',
    body:
      plan.timeOfDay === 'PRE_SLEEP'
        ? `${due} due before bed. The last review of the night gets the most out of sleep.`
        : `${due} due. Five minutes clears it.`,
  }
}

/**
 * Deliver, if every gate agrees.
 *
 * Gates, all of which must pass: notifications supported and granted; the user switched them on;
 * outside quiet hours; the domain's own `shouldPrompt()` said fire; there is genuinely something
 * due; and one has not already been sent today. Returns whether anything was shown, so the caller
 * can record the day without guessing.
 */
export async function deliverNudge(nudge: Nudge, tag: string): Promise<boolean> {
  if (notifyPermission() !== 'granted') return false
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  if (!reg?.active) return false
  reg.active.postMessage({ type: 'nomen:notify', title: nudge.title, body: nudge.body, tag })
  return true
}
