/**
 * Contrast gate.
 *
 * Parses the design tokens out of `src/ui/tokens.css`, resolves them per theme, and checks every
 * foreground/background pair the app actually renders against WCAG AA. Exits non-zero on failure.
 *
 *   npm run check:contrast
 *
 * This exists as a build gate rather than a one-off audit because an app whose entire pitch is
 * "we refuse to overstate what we can support" cannot ship text nobody can read. The pair list
 * below is the contract: when a new colour combination appears in a component, it gets a row here.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const TOKENS = join(here, '..', 'src', 'ui', 'tokens.css')

// ── Colour maths ──────────────────────────────────────────────────────────────

function toLinear(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function parseHex(hex) {
  const h = hex.trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg, bg) {
  const a = luminance(fg)
  const b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/** Flatten a translucent colour over its backdrop, so the checked ratio is the rendered one. */
function composite(fg, alpha, bg) {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))
}

// ── Token extraction ──────────────────────────────────────────────────────────

/**
 * Pulls `--name: value` declarations out of a block. Blocks are identified by marker comments so
 * that this stays robust as the stylesheet grows:
 *
 *   \/* @tokens dark *\/  :root { ... }
 *   \/* @tokens light *\/ :root[data-theme="light"] { ... }
 */
function extractTheme(css, theme) {
  const marker = new RegExp(`/\\*\\s*@tokens\\s+${theme}\\s*\\*/`)
  const at = css.search(marker)
  if (at === -1) throw new Error(`No "@tokens ${theme}" marker found in tokens.css`)
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  const block = css.slice(open + 1, close)

  const out = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

/** Resolves a token to concrete rgb, following `var()` chains and colour-mix percentages. */
function resolve(tokens, value, depth = 0) {
  if (depth > 8) return null
  const v = value.trim()

  const direct = parseHex(v)
  if (direct) return direct

  const varMatch = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/)
  if (varMatch) {
    const target = tokens[varMatch[1]]
    if (target) return resolve(tokens, target, depth + 1)
    if (varMatch[2]) return resolve(tokens, varMatch[2], depth + 1)
    return null
  }

  // color-mix(in oklab, A X%, B) — approximated in sRGB, which is close enough for a gate whose
  // job is catching real failures rather than certifying exact ratios.
  const mix = v.match(/^color-mix\([^,]+,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\s*\)$/)
  if (mix) {
    const a = resolve(tokens, mix[1], depth + 1)
    const b = resolve(tokens, mix[3], depth + 1)
    if (!a || !b) return null
    const t = parseFloat(mix[2]) / 100
    return a.map((c, i) => Math.round(c * t + b[i] * (1 - t)))
  }

  const rgba = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/)
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3]]

  return null
}

// ── The contract ──────────────────────────────────────────────────────────────
// `large: true` means ≥18.66px bold or ≥24px regular. `ui: true` means a non-text boundary
// (borders, marks, focus rings) which AA holds to 3:1.

const PAIRS = [
  { label: 'body text on page', fg: '--ink', bg: '--bg' },
  { label: 'body text on card', fg: '--ink', bg: '--surface' },
  { label: 'secondary text on card', fg: '--ink-2', bg: '--surface' },
  { label: 'muted text on card', fg: '--ink-3', bg: '--surface' },
  { label: 'muted text on page', fg: '--ink-3', bg: '--bg' },
  { label: 'display heading on page', fg: '--ink', bg: '--bg', large: true },
  { label: 'accent text on page', fg: '--accent-text', bg: '--bg' },
  { label: 'accent text on card', fg: '--accent-text', bg: '--surface' },
  { label: 'primary button label', fg: '--on-accent', bg: '--accent' },
  { label: 'tab bar: inactive', fg: '--ink-3', bg: '--bg-nav' },
  { label: 'tab bar: active', fg: '--accent-text', bg: '--bg-nav' },
  { label: 'positive status text', fg: '--good-text', bg: '--surface' },
  { label: 'caution status text', fg: '--warn-text', bg: '--surface' },
  { label: 'negative status text', fg: '--bad-text', bg: '--surface' },
  { label: 'chart mark on card', fg: '--viz-mark', bg: '--surface', ui: true },
  { label: 'chart tick text', fg: '--ink-3', bg: '--surface' },
  { label: 'card border', fg: '--line', bg: '--bg', ui: true },
  { label: 'input border', fg: '--line-strong', bg: '--surface', ui: true },
  { label: 'focus ring', fg: '--focus', bg: '--bg', ui: true },
  { label: 'focus ring on card', fg: '--focus', bg: '--surface', ui: true },
]

function checkTheme(css, theme) {
  const tokens = extractTheme(css, theme)
  const results = []

  for (const pair of PAIRS) {
    const fgRaw = tokens[pair.fg]
    const bgRaw = tokens[pair.bg]
    if (!fgRaw || !bgRaw) {
      results.push({ ...pair, theme, ratio: null, need: null, verdict: 'MISSING' })
      continue
    }
    let fg = resolve(tokens, fgRaw)
    const bg = resolve(tokens, bgRaw)
    if (!fg || !bg) {
      results.push({ ...pair, theme, ratio: null, need: null, verdict: 'UNRESOLVED' })
      continue
    }
    if (pair.alpha) fg = composite(fg, pair.alpha, bg)

    const ratio = contrast(fg, bg)
    const need = pair.large || pair.ui ? 3 : 4.5
    results.push({
      ...pair,
      theme,
      ratio: Math.round(ratio * 100) / 100,
      need,
      verdict: ratio >= need ? 'PASS' : 'FAIL',
    })
  }
  return results
}

const css = readFileSync(TOKENS, 'utf8')
const all = [...checkTheme(css, 'dark'), ...checkTheme(css, 'light')]

console.table(
  all.map((r) => ({
    theme: r.theme,
    pair: r.label,
    ratio: r.ratio ?? '—',
    needs: r.need ?? '—',
    verdict: r.verdict,
  })),
)

const bad = all.filter((r) => r.verdict !== 'PASS')
if (bad.length > 0) {
  console.error(`\n${bad.length} problem(s):`)
  for (const b of bad) {
    console.error(
      `  [${b.theme}] ${b.label}: ${b.verdict}` +
        (b.ratio ? ` — ${b.ratio}:1, needs ${b.need}:1` : ` — ${b.fg} or ${b.bg} could not be resolved`),
    )
  }
  process.exit(1)
}
console.log(`\nAll ${all.length} pairs pass WCAG AA across both themes.`)
