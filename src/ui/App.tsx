import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { selectPlan, useStore } from '../state/store'
import { shouldPrompt, timeOfDay } from '../domain/program/dailyPlan'
import { dayKey } from '../domain/time'
import { deliverNudge, inQuietHours, notifyPermission, nudgeFor } from '../lib/notify'
import { useNow } from './hooks'
import { IconCapture, IconInsights, IconPeople, IconProgram, IconToday } from './icons'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import Capture from './screens/Capture'
import Session from './screens/Session'
import People from './screens/People'
import PersonDetail from './screens/PersonDetail'
import Insights from './screens/Insights'
import Program from './screens/Program'
import Baseline from './screens/Baseline'
import Gallery from './screens/Gallery'
import Journal from './screens/Journal'
import SettingsScreen from './screens/Settings'
import Tracks from './screens/Tracks'

const TABS = [
  { to: '/today', Icon: IconToday, label: 'Today' },
  { to: '/capture', Icon: IconCapture, label: 'Capture' },
  { to: '/people', Icon: IconPeople, label: 'People' },
  { to: '/insights', Icon: IconInsights, label: 'Insights' },
  { to: '/program', Icon: IconProgram, label: 'Program' },
]

export default function App() {
  const loaded = useStore((s) => s.loaded)
  const load = useStore((s) => s.load)
  const settings = useStore((s) => s.settings)
  const firstRun = useStore((s) => s.people.length === 0 && s.assessments.length === 0)
  const now = useNow(60_000)
  const location = useLocation()

  useEffect(() => {
    void load()
  }, [load])

  /**
   * The pre-sleep variant.
   *
   * The app's own scheduler already knows when the consolidation slot is open, so the interface
   * drops a step of ink and a step of accent chroma for the window it is actually used in. Both
   * still clear AA. This is a design preference for the hour, not a sleep-protection claim — the
   * evidence map carries no such claim and the charter binds the design's account of itself as
   * much as it binds the copy.
   */
  useEffect(() => {
    if (!loaded) return
    const slot = timeOfDay(now, settings)
    const root = document.documentElement
    if (slot === 'PRE_SLEEP') root.setAttribute('data-slot', 'pre-sleep')
    else root.removeAttribute('data-slot')
  }, [loaded, now, settings])

  /**
   * The nudge.
   *
   * `shouldPrompt()` has decided *whether* to fire since v0.1 and had no delivery mechanism; this
   * is it. Six gates must all agree — opted in, permission granted, outside quiet hours, the
   * domain says fire, something is genuinely due, and none sent today — and the day is stamped
   * before the notification rather than after, so a failure part-way through cannot produce two.
   *
   * Runs on the same one-minute clock as the pre-sleep theme, which is frequent enough for a slot
   * that lasts hours and far too infrequent to nag.
   */
  useEffect(() => {
    if (!loaded || !settings.notificationsEnabled) return
    if (notifyPermission() !== 'granted') return
    if (inQuietHours(now)) return

    const day = dayKey(now)
    if (settings.lastNudgeDay === day) return

    const state = useStore.getState()
    const plan = selectPlan(state, now)
    const today = state.days.find((d) => d.day === day)
    if (!shouldPrompt(plan, now, today).fire) return

    const nudge = nudgeFor(plan)
    if (!nudge) return

    void (async () => {
      // Stamped first. If delivery throws after a successful show, a retry next minute would send
      // a second notification for the same day — the one thing the promise rules out.
      await state.updateSettings({ lastNudgeDay: day })
      const shown = await deliverNudge(nudge, `nomen-${day}`)
      if (!shown) await state.updateSettings({ lastNudgeDay: undefined })
    })()
  }, [loaded, now, settings.notificationsEnabled, settings.lastNudgeDay])

  if (!loaded) {
    return (
      <div className="app">
        <p className="empty">Opening your local database…</p>
      </div>
    )
  }

  return (
    <>
      <div className="app">
        <Routes location={location}>
          {/* A first run has no people and no baseline, so the app opens on the claim it makes
              about itself — including the parts it says are not achievable. */}
          <Route
            path="/"
            element={<Navigate to={firstRun ? '/onboarding' : '/today'} replace />}
          />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/today" element={<Today />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/session" element={<Session />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:id" element={<PersonDetail />} />
          <Route path="/tracks" element={<Tracks />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/program" element={<Program />} />
          <Route path="/baseline" element={<Baseline />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
        <div className="page-end" />
      </div>

      {location.pathname !== '/onboarding' && (
      <nav className="nav" aria-label="Sections">
        {TABS.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="nav__item"
            /* NavLink stamps aria-current="page" when active — that is both the assistive
               channel and the hook the stylesheet selects on. The moving rule, the icon fill,
               the ink step and the weight step are the four visual channels, so selection is
               never carried by colour alone. */
          >
            {({ isActive }) => (
              <>
                <span className="nav__mark" aria-hidden />
                <Icon active={isActive} />
                <span className="nav__label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      )}
    </>
  )
}

/** Kept exported so screens can read the plan without importing the store selector directly. */
export { selectPlan }
