import { useState } from 'react'
import { useStore } from '../../state/store'
import { exportAll, wipeAll, type ExportBundle } from '../../data/db'
import { seedDemoData } from '../../data/seed'
import { Evidence, Header } from '../components'

export default function SettingsScreen() {
  const state = useStore()
  const s = state.settings
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function doExport() {
    const bundle = await exportAll(Date.now())
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nomen-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header title="Settings" back="/program" />

      <h2>Schedule</h2>
      <div className="card">
        <div className="field">
          <label>Interval shape</label>
          <div className="chips">
            {(
              [
                ['expanding', 'Expanding'],
                ['uniform', 'Uniform'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={`chip${s.scheduleMode === value ? ' on' : ''}`}
                onClick={() => void state.updateSettings({ scheduleMode: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <Evidence>
            This is a real setting rather than a hidden flag because the question is genuinely
            unresolved: a 2020 meta-analysis found essentially no overall difference between
            expanding and uniform spacing (g ≈ 0.03), though expanding tends to win when initial
            learning is weak — which is the state of a name you heard twenty seconds ago. Expanding
            is the default for that reason, not because the matter is settled.
          </Evidence>
        </div>

        <div className="field">
          <label htmlFor="intake">New people per day: {s.intakeCapPerDay}</label>
          <input
            id="intake"
            type="range"
            min={1}
            max={15}
            value={s.intakeCapPerDay}
            onChange={(e) => void state.updateSettings({ intakeCapPerDay: +e.target.value })}
          />
          <div className="dim">
            The most important number in the app. Uncapped intake is how spaced-repetition tools kill
            themselves: a flood week becomes a wall, and the wall is where people quit.
          </div>
        </div>

        <div className="field">
          <label htmlFor="ceiling">Retrievals per day: {s.dailyRetrievalCeiling}</label>
          <input
            id="ceiling"
            type="range"
            min={5}
            max={80}
            value={s.dailyRetrievalCeiling}
            onChange={(e) => void state.updateSettings({ dailyRetrievalCeiling: +e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="presleep">Pre-sleep review at {s.preSleepHour}:00</label>
          <input
            id="presleep"
            type="range"
            min={18}
            max={23}
            value={s.preSleepHour}
            onChange={(e) => void state.updateSettings({ preSleepHour: +e.target.value })}
          />
          <div className="dim">
            Declarative memories consolidate during deep sleep, so the last review before bed gets
            the most out of the night. It is also the steadiest anchor in most people’s day.
          </div>
        </div>
      </div>

      <h2>Your data</h2>
      <div className="card">
        <p className="small muted">
          Everything lives in this browser’s local database. There is no account, no server, and no
          code path in this app that sends a photograph or a note anywhere. That is a structural
          decision, not a policy promise — the database is full of other people’s faces, and they
          never agreed to be uploaded to anything.
        </p>
        <button className="full" onClick={() => void doExport()}>
          Export everything as JSON
        </button>
        <div className="spacer" />
        <label htmlFor="import" className="small">
          Import a previous export
        </label>
        <input
          id="import"
          type="file"
          accept="application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setBusy('Importing…')
            const bundle = JSON.parse(await file.text()) as ExportBundle
            await state.replaceAll(bundle)
            setBusy(null)
          }}
        />
      </div>

      <h2>Demo data</h2>
      <div className="card">
        <p className="small muted">
          Generates a simulated eight months of practice — people, encounters, schedules, and a
          realistic attempt history — so the Insights and Program screens have something to show.
          Clearly fictional, and safe to wipe.
        </p>
        <button
          className="full"
          disabled={busy !== null}
          onClick={async () => {
            setBusy('Generating…')
            await seedDemoData(Date.now())
            await state.load()
            setBusy(null)
          }}
        >
          {busy ?? 'Generate demo history'}
        </button>
      </div>

      <h2>Erase</h2>
      <div className="card">
        {confirmWipe ? (
          <div className="row">
            <button
              className="danger grow"
              onClick={async () => {
                await wipeAll()
                await state.load()
                setConfirmWipe(false)
              }}
            >
              Erase everything permanently
            </button>
            <button onClick={() => setConfirmWipe(false)}>Cancel</button>
          </div>
        ) : (
          <button className="danger full" onClick={() => setConfirmWipe(true)}>
            Erase all data
          </button>
        )}
        <div className="dim" style={{ marginTop: 8 }}>
          Immediate and unrecoverable. Export first if you want a copy.
        </div>
      </div>

      <h2>What this app will not do</h2>
      <div className="card">
        <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Claim you will remember names effortlessly, permanently, or universally.</li>
          <li>Ship brain-training games — generic cognitive training does not transfer.</li>
          <li>Coach imagery mnemonics during a live conversation, where they collapse.</li>
          <li>Send you a notification you did not configure, or any between 22:00 and 07:00.</li>
          <li>Use guilt, countdowns, or manufactured urgency to get you back.</li>
          <li>Upload anything, ever.</li>
        </ul>
      </div>
    </>
  )
}
