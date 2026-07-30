import { useState, type CSSProperties } from 'react'
import { useStore } from '../../state/store'
import { exportAll, wipeAll, type ExportBundle } from '../../data/db'
import { seedDemoData } from '../../data/seed'
import type { Settings } from '../../domain/types'
import { Chips, Evidence, Header } from '../components'
import { IconMoon, IconSun } from '../icons'
import { useTheme, type ThemeChoice } from '../theme'
import { notifyPermission, requestNotifyPermission } from '../../lib/notify'

/**
 * Settings — the schedule, the data, and the charter.
 *
 * Two things on this screen are load-bearing beyond their function:
 *
 * - **The erase confirmation** is the only place in the application where a destructive colour
 *   appears, and on confirm it inverts to a solid ink block rather than turning redder. A
 *   destructive action should read as *heavy*, not as *alarming*.
 * - **The charter** is set as prose at body size behind a strong rule, not as fine print. It is
 *   the product's argument about itself; typesetting it small would be the first thing it
 *   promises not to do.
 *
 * The plate at the foot is a standing, factual restatement of the privacy invariant, with the real
 * counts beside it. It is the app's visible bottom edge — the structural opposite of a feed.
 */

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const SCHEDULE_MODES: { value: Settings['scheduleMode']; label: string }[] = [
  { value: 'expanding', label: 'Expanding' },
  { value: 'uniform', label: 'Uniform' },
]

/** Body size, --ink-2, one strong left rule, and room to breathe. A charter, not a footnote. */
const CHARTER: CSSProperties = {
  display: 'grid',
  rowGap: 'var(--s-4)',
  margin: 0,
  paddingInlineStart: 'var(--s-5)',
  borderInlineStart: '2px solid var(--line-strong)',
  listStyle: 'none',
  maxInlineSize: 'var(--measure)',
  fontSize: 'var(--t-body)',
  lineHeight: 'var(--lh-body)',
  color: 'var(--ink-2)',
}

const RESOLVED_LINE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--s-2)',
}

export default function SettingsScreen() {
  const state = useStore()
  const s = state.settings
  const [theme, setTheme, resolved] = useTheme()
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [perm, setPerm] = useState(() => notifyPermission())

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

      <h2>Appearance</h2>
      <div className="card">
        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label>Theme</label>
          <Chips options={THEMES} value={theme} onChange={setTheme} label="Theme" />
          <p className="dim" style={RESOLVED_LINE}>
            {resolved === 'dark' ? <IconMoon /> : <IconSun />}
            <span>Currently {resolved}</span>
          </p>
          <p className="dim">
            Dark is the design’s home key — the pre-sleep review happens in a dark room. Capture
            happens mid-conversation in daylight, so light is a first-class theme, not a courtesy.
          </p>
        </div>
      </div>

      <h2>Schedule</h2>
      <div className="card">
        <div className="field">
          <label>Interval shape</label>
          <Chips
            options={SCHEDULE_MODES}
            value={s.scheduleMode}
            onChange={(v) => void state.updateSettings({ scheduleMode: v })}
            label="Interval shape"
          />
          <Evidence>
            This is a real setting rather than a hidden flag because the question is genuinely
            unresolved: a 2020 meta-analysis found essentially no overall difference between
            expanding and uniform spacing (g ≈ 0.03), though expanding tends to win when initial
            learning is weak — which is the state of a name you heard twenty seconds ago. Expanding
            is the default for that reason, not because the matter is settled.
          </Evidence>
        </div>

        <div className="field">
          <label htmlFor="intake">
            New people per day: <span className="fig">{s.intakeCapPerDay}</span>
          </label>
          <input
            id="intake"
            type="range"
            min={1}
            max={15}
            value={s.intakeCapPerDay}
            onChange={(e) => void state.updateSettings({ intakeCapPerDay: +e.target.value })}
          />
          <p className="dim">
            The most important number in the app. Uncapped intake is how spaced-repetition tools kill
            themselves: a flood week becomes a wall, and the wall is where people quit.
          </p>
        </div>

        <div className="field">
          <label htmlFor="ceiling">
            Retrievals per day: <span className="fig">{s.dailyRetrievalCeiling}</span>
          </label>
          <input
            id="ceiling"
            type="range"
            min={5}
            max={80}
            value={s.dailyRetrievalCeiling}
            onChange={(e) => void state.updateSettings({ dailyRetrievalCeiling: +e.target.value })}
          />
        </div>

        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label htmlFor="presleep">
            Pre-sleep review at <span className="fig">{s.preSleepHour}:00</span>
          </label>
          <input
            id="presleep"
            type="range"
            min={18}
            max={23}
            value={s.preSleepHour}
            onChange={(e) => void state.updateSettings({ preSleepHour: +e.target.value })}
          />
          <p className="dim">
            Declarative memories consolidate during deep sleep, so the last review before bed gets
            the most out of the night. It is also the steadiest anchor in most people’s day.
          </p>
        </div>
      </div>

      <h2>Reminders</h2>
      <div className="card">
        {perm === 'unsupported' ? (
          <p className="record-note">This browser cannot show notifications, so reminders are unavailable.</p>
        ) : perm === 'denied' ? (
          <p className="record-note">
            Notifications are blocked for this site in your browser settings. Nomen cannot undo that
            from here — it has to be changed where you blocked it.
          </p>
        ) : (
          <>
            <Chips
              label="Review nudges"
              value={state.settings.notificationsEnabled && perm === 'granted' ? 'on' : 'off'}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on', label: 'On' },
              ]}
              onChange={(v) => {
                void (async () => {
                  if (v === 'off') {
                    await state.updateSettings({ notificationsEnabled: false })
                    return
                  }
                  // Only ever asked from this tap. An unsolicited permission dialog on load is
                  // precisely "a notification you did not configure".
                  const result = await requestNotifyPermission()
                  setPerm(result)
                  await state.updateSettings({ notificationsEnabled: result === 'granted' })
                })()
              }}
            />
            <p className="record-note">
              At most one a day, never between{' '}
              <span className="fig">22</span>:00 and <span className="fig">07</span>:00, and only
              when something is genuinely due. It fires on your state rather than on a fixed hour —
              the pre-sleep slot with a queue, a morning worth clearing, or three names at real
              decay risk.
            </p>
            <p className="record-note">
              No server is involved. The page decides and hands the message to its own service
              worker, so there is no channel by which anyone else could send you one.
            </p>
          </>
        )}
      </div>

      <h2>Voice</h2>
      <div className="card">
        <Chips
          label="Record voices"
          value={state.settings.voiceCaptureEnabled ? 'on' : 'off'}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
          onChange={(v) => void state.updateSettings({ voiceCaptureEnabled: v === 'on' })}
        />
        <p className="record-note">
          Off by default, and deliberately a separate decision from photographs. Recording someone
          is a different act from photographing them — in a fair number of places a different act
          legally — and this is the one capture the app will not let you default into.
        </p>
        <p className="record-note">
          With it on, a hold-to-record control appears on each person. Nothing records unless a
          finger is on it, clips stop at eight seconds, and the microphone is released the instant
          you let go. Clips never leave this device, like everything else here.
        </p>
      </div>

      <h2>Your data</h2>
      <div className="card">
        <p className="muted">
          Everything lives in this browser’s local database. There is no account, no server, and no
          code path in this app that sends a photograph or a note anywhere. That is a structural
          decision, not a policy promise — the database is full of other people’s faces, and they
          never agreed to be uploaded to anything.
        </p>
        <button className="primary full" onClick={() => void doExport()}>
          Export everything as JSON
        </button>
        <div className="field" style={{ marginBlockStart: 'var(--s-5)', marginBlockEnd: 0 }}>
          <label htmlFor="import">Import a previous export</label>
          <input
            id="import"
            type="file"
            accept="application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy('Importing…')
              setImportError(null)
              try {
                // Both halves can fail on a file a user picked by hand: JSON.parse on anything
                // that is not JSON, and validateBundle on JSON that is not an export. Unhandled,
                // either one left the spinner running forever with no explanation.
                const bundle = JSON.parse(await file.text()) as ExportBundle
                await state.replaceAll(bundle)
              } catch (err) {
                setImportError(
                  err instanceof SyntaxError
                    ? 'That file is not valid JSON, so it cannot be a Nomen export.'
                    : err instanceof Error
                      ? err.message
                      : 'That import could not be read.',
                )
              } finally {
                setBusy(null)
                e.target.value = ''
              }
            }}
          />
          {/* A refusal is an answer, so it is stated at full strength rather than whispered. */}
          {importError && <p className="record-note">{importError}</p>}
          <p className="record-note">
            Nothing is written unless the whole file checks out. An import replaces everything in
            one transaction, so a bad file leaves your data exactly as it was.
          </p>
        </div>
      </div>

      <h2>Demo data</h2>
      <div className="card">
        <p className="dim">
          Generates a simulated eight months of practice — people, encounters, schedules, and a
          realistic attempt history — so the Insights and Program screens have something to show.
          Clearly fictional, and safe to wipe.
        </p>
        <button
          className="full ghost"
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
              data-confirm="true"
              onClick={async () => {
                await wipeAll()
                await state.load()
                setConfirmWipe(false)
              }}
            >
              Erase everything permanently
            </button>
            <button className="ghost" onClick={() => setConfirmWipe(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="danger full" onClick={() => setConfirmWipe(true)}>
            Erase all data
          </button>
        )}
        <p className="record-note">Immediate and unrecoverable. Export first if you want a copy.</p>
      </div>

      <h2>What this app will not do</h2>
      <ul style={CHARTER}>
        <li>Claim you will remember names effortlessly, permanently, or universally.</li>
        <li>Ship brain-training games — generic cognitive training does not transfer.</li>
        <li>Coach imagery mnemonics during a live conversation, where they collapse.</li>
        <li>Send you a notification you did not configure, or any between 22:00 and 07:00.</li>
        <li>Use guilt, countdowns, or manufactured urgency to get you back.</li>
        <li>Upload anything, ever.</li>
      </ul>

      <p className="plate">
        NOMEN v0.1.0 · LOCAL DB · NO NETWORK · {state.people.length.toLocaleString()} PEOPLE ·{' '}
        {state.attempts.length.toLocaleString()} RETRIEVALS
      </p>
    </>
  )
}
