import { describe, expect, it } from 'vitest'
import { ImportError, validateBundle, type ExportBundle } from '../src/data/db'
import { dataUrlToBlob } from '../src/lib/media'
import { DEFAULT_SETTINGS } from '../src/domain/types'

/**
 * The import path is the only place a user can hand this app a file, and the app has no trash.
 * A half-applied import is unrecoverable, so everything here is about refusing early.
 */

function bundle(over: Partial<ExportBundle> = {}): unknown {
  return {
    version: 2,
    exportedAt: 0,
    people: [],
    media: [],
    items: [],
    attempts: [],
    days: [],
    missions: [],
    moments: [],
    assessments: [],
    settings: DEFAULT_SETTINGS,
    ...over,
  }
}

describe('an import is checked before anything is written', () => {
  it('accepts a well-formed bundle', () => {
    expect(() => validateBundle(bundle())).not.toThrow()
  })

  it.each([
    ['null', null],
    ['a string', 'not a bundle'],
    ['a number', 42],
    ['an array', []],
  ])('refuses %s', (_label, value) => {
    expect(() => validateBundle(value)).toThrow(ImportError)
  })

  it('refuses a file with no version stamp — the old code never even read it', () => {
    const b = bundle() as Record<string, unknown>
    delete b.version
    expect(() => validateBundle(b)).toThrow(/version/i)
  })

  it('refuses a bundle from a newer schema rather than silently dropping fields', () => {
    expect(() => validateBundle(bundle({ version: 99 }))).toThrow(/newer version/i)
  })

  it('accepts a bundle from an older schema, because those are readable', () => {
    expect(() => validateBundle(bundle({ version: 1 }))).not.toThrow()
  })

  it('refuses a truncated file missing a whole record type', () => {
    const b = bundle() as Record<string, unknown>
    delete b.attempts
    expect(() => validateBundle(b)).toThrow(/attempts/)
  })

  it('refuses records of the right name but the wrong shape', () => {
    expect(() => validateBundle(bundle({ people: [{ nope: true }] as never }))).toThrow(/person/i)
    expect(() => validateBundle(bundle({ items: [{ id: 'i1' }] as never }))).toThrow(/schedule item/i)
  })

  it('refuses missing settings', () => {
    const b = bundle() as Record<string, unknown>
    delete b.settings
    expect(() => validateBundle(b)).toThrow(/settings/i)
  })

  it('names what is wrong, so the refusal is usable', () => {
    try {
      validateBundle(bundle({ version: 99 }))
      expect.unreachable()
    } catch (e) {
      expect((e as Error).message).toMatch(/99/)
      expect((e as Error).message).toMatch(/2/)
    }
  })
})

describe('media round-trips out of the legacy format', () => {
  it('decodes a base64 data URL to bytes of the right length and type', async () => {
    // "hello" in base64.
    const blob = dataUrlToBlob('data:text/plain;base64,aGVsbG8=')
    expect(blob).not.toBeNull()
    expect(blob!.type).toBe('text/plain')
    expect(blob!.size).toBe(5)
    expect(await blob!.text()).toBe('hello')
  })

  it('decodes a percent-encoded data URL — the demo generator writes SVG this way', async () => {
    const blob = dataUrlToBlob('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')
    expect(blob).not.toBeNull()
    expect(await blob!.text()).toBe('<svg></svg>')
  })

  it('returns null rather than throwing on something that is not a data URL', () => {
    expect(dataUrlToBlob('https://example.com/a.jpg')).toBeNull()
    expect(dataUrlToBlob('')).toBeNull()
  })

  it('returns null on a corrupt payload, so migration leaves the record alone', () => {
    // A record that will not convert must be kept as-is: dropping it would destroy a photograph of
    // a real person in order to tidy up a storage format.
    expect(dataUrlToBlob('data:image/jpeg;base64,!!!not-base64!!!')).toBeNull()
  })

  it('is smaller than the base64 that encoded it', () => {
    const payload = 'A'.repeat(3000)
    const blob = dataUrlToBlob(`data:image/jpeg;base64,${btoa(payload)}`)
    expect(blob!.size).toBe(3000)
    expect(blob!.size).toBeLessThan(btoa(payload).length)
  })
})
