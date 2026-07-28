import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from '../state/store'
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
  { to: '/today', icon: '◎', label: 'Today' },
  { to: '/capture', icon: '＋', label: 'Capture' },
  { to: '/people', icon: '☰', label: 'People' },
  { to: '/insights', icon: '◔', label: 'Insights' },
  { to: '/program', icon: '⟡', label: 'Program' },
]

export default function App() {
  const loaded = useStore((s) => s.loaded)
  const load = useStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) {
    return (
      <div className="app">
        <div className="empty">Opening your local database…</div>
      </div>
    )
  }

  return (
    <>
      <div className="app">
        <Routes>
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
      </div>
      <nav className="nav">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
