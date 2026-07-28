import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isHuman, MODES_FOR_TRACK, type TrackKind } from '../src/domain/types'

const ROOT = join(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * The visual system has three laws that are cheap to break by accident and expensive to notice.
 * They are asserted here rather than trusted to review.
 */

describe('the serif law — one typeface, reserved for human beings', () => {
  it('treats a person and a fictional character as human, and a place as not', () => {
    expect(isHuman('PERSON')).toBe(true)
    expect(isHuman('CAST')).toBe(true)
    expect(isHuman('PLACE')).toBe(false)
  })

  it('covers every track that exists, so a new one cannot silently default to human', () => {
    const tracks = Object.keys(MODES_FOR_TRACK) as TrackKind[]
    expect(tracks.sort()).toEqual(['CAST', 'PERSON', 'PLACE'])
    for (const t of tracks) expect(typeof isHuman(t)).toBe('boolean')
  })

  it('declares the serif family in exactly one place in the stylesheet', () => {
    const css = read('src/ui/styles.css')
    const uses = css.match(/var\(--font-serif\)/g) ?? []
    // .person-name, .answer__name, and the one drop cap on the capability statement.
    expect(uses.length).toBeLessThanOrEqual(3)
  })
})

describe('the type-size law — no figure outranks a name', () => {
  const tokens = read('src/ui/tokens.css')

  it('caps the largest figure below the smallest rendering of a name', () => {
    // --t-name: clamp(2rem, …) → 32px floor. --t-figure: 1.75rem → 28px.
    const nameFloor = tokens.match(/--t-name:\s*clamp\(([\d.]+)rem/)
    const figure = tokens.match(/--t-figure:\s*([\d.]+)rem/)
    expect(nameFloor).not.toBeNull()
    expect(figure).not.toBeNull()
    expect(parseFloat(figure![1])).toBeLessThan(parseFloat(nameFloor![1]))
  })

  it('sets the streak smaller than the lifetime count it sits above', () => {
    const css = read('src/ui/styles.css')
    // .stat--streak steps the value down to lede; the plain .stat__value stays at figure size.
    expect(css).toMatch(/\.stat--streak \.stat__value \{\s*font-size: var\(--t-lede\)/)
  })
})

describe('the charter, enforced in the stylesheet', () => {
  const css = read('src/ui/styles.css')

  it('makes every meter structurally incapable of filling', () => {
    expect(css).toMatch(/\.bar > span,\s*\n\.viz-bar-fill \{\s*\n\s*transition: none !important/)
  })

  it('ships no keyframe animations at all', () => {
    expect(css).not.toMatch(/@keyframes/)
  })

  it('has no box-shadow with a blur radius — elevation is a border, never a glow', () => {
    // Permitted: `0 0 0 Npx <colour>` hairline rings, and `none`.
    const shadows = css.match(/box-shadow:\s*([^;]+);/g) ?? []
    for (const s of shadows) {
      const value = s.replace(/box-shadow:\s*/, '').replace(';', '').trim()
      if (value === 'none' || value.startsWith('var(')) continue
      expect(value, `blurred shadow found: ${s}`).toMatch(/^inset\s+0 0 0|^0 0 0/)
    }
  })

  it('loads no font, stylesheet or asset over the network', () => {
    for (const file of ['src/ui/styles.css', 'src/ui/tokens.css']) {
      const text = read(file)
      expect(text, `${file} fetches a remote resource`).not.toMatch(/@import\s+url\(|https?:\/\//)
    }
  })
})

describe('the honesty rail', () => {
  it('never renders a value below the 14px floor', () => {
    const tokens = read('src/ui/tokens.css')
    const meta = tokens.match(/--t-meta:\s*([\d.]+)rem/)
    const kicker = tokens.match(/--t-kicker:\s*([\d.]+)rem/)
    expect(parseFloat(meta![1]) * 16).toBeGreaterThanOrEqual(14)
    // The kicker is the one step below 14px and it is never the sole carrier of information.
    expect(parseFloat(kicker![1]) * 16).toBe(12)
  })

  it('keeps the refusal at full label strength — the row is a mode, not a fault', () => {
    const css = read('src/ui/styles.css')
    const refusal = css.match(/\.stat\[data-sufficient='false'\][^}]+\}/g) ?? []
    expect(refusal.length).toBeGreaterThan(0)
    for (const rule of refusal) {
      expect(rule, 'the refusal state must not dim or fade the row').not.toMatch(/opacity/)
    }
  })
})
