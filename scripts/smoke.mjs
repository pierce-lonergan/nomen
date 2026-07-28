/**
 * Browser smoke test.
 *
 * Loads every screen against a production build with demo data generated, and fails if the console
 * reports an error or a screen renders nothing. Not a substitute for the unit tests — those cover
 * the domain logic — but it catches the class of breakage unit tests never see: a screen that
 * throws on render.
 *
 *   npm run build
 *   npm run preview &
 *   npm run smoke
 *
 * Set CHROMIUM_PATH if Playwright's bundled browser isn't installed (e.g. a sandbox that ships its
 * own Chromium). Set SMOKE_OUT to collect full-page screenshots.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173'
const OUT = process.env.SMOKE_OUT ?? null
if (OUT) mkdirSync(OUT, { recursive: true })

const SCREENS = [
  ['#/today', 'today'],
  ['#/insights', 'insights'],
  ['#/program', 'program'],
  ['#/people', 'people'],
  ['#/capture', 'capture'],
  ['#/session', 'session'],
  ['#/baseline', 'baseline'],
  ['#/journal', 'journal'],
  ['#/tracks', 'tracks'],
  ['#/settings', 'settings'],
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })

const errors = []
page.on('console', (m) => {
  // A 404 for a favicon we deliberately don't ship is not a failure.
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: /Generate demo history/i }).click()
await page.waitForTimeout(3000)

for (const [hash, name] of SCREENS) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const body = await page.textContent('body')
  if (!body || body.trim().length < 40) errors.push(`${name}: rendered essentially nothing`)
  if (OUT) await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
}

await browser.close()

if (errors.length > 0) {
  console.error(`smoke failed with ${errors.length} error(s):\n${errors.join('\n')}`)
  process.exit(1)
}
console.log(`smoke passed — ${SCREENS.length} screens rendered clean`)
