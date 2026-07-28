import { useEffect, useState } from 'react'

/**
 * Theme selection.
 *
 * Dark is the design's home key — the app's primary usage moment is the pre-sleep consolidation
 * review, in a dark room, at low screen brightness. But it is genuinely bi-modal: the capture
 * protocol happens in daylight, mid-conversation, often outdoors. So light is a first-class theme,
 * not a courtesy.
 *
 * Default is `system`, and the stored preference is the only thing this app has ever needed
 * localStorage for — everything else lives in IndexedDB with the user's actual data.
 */

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'nomen.theme'

function stored(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'system'
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

/**
 * Stamps `data-theme` on the root element.
 *
 * The CSS is written so that the OS preference is honoured through a media query, and the stamped
 * attribute overrides it in *both* directions — so a user who prefers dark system-wide but wants
 * Nomen light gets Nomen light.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void, 'light' | 'dark'] {
  const [choice, setChoice] = useState<ThemeChoice>(stored)
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyTheme(choice)
    try {
      localStorage.setItem(KEY, choice)
    } catch {
      // Private-mode storage refusal is not worth breaking the app over.
    }
  }, [choice])

  const resolved: 'light' | 'dark' = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice
  return [choice, setChoice, resolved]
}

/**
 * True when the user has asked the OS to reduce motion.
 *
 * Every transition in the app is gated on this. The reduced-motion path is not "faster
 * animation" — it is *no* animation, with the end state applied directly.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
