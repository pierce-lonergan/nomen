import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { selectPlan, useStore } from '../state/store'
import { timeOfDay } from '../domain/program/dailyPlan'
import { useNow } from './hooks'
import { IconCapture, IconInsights, IconPeople, IconProgram, IconToday } from './icons'
import Today from './screens/Today'
import Capture from './screens/Capture'
import Session from './screens/Session'
import People from './screens/People'
import PersonDetail from './screens/PersonDetail'
import Insights from './screens/Insights'
import Program from './screens/Program'
import Baseline from './screens/Baseline'
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
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/session" element={<Session />} />
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
    </>
  )
}

/** Kept exported so screens can read the plan without importing the store selector directly. */
export { selectPlan }
