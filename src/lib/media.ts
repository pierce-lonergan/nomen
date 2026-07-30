import type { MediaRef } from '../domain/types'

/**
 * Turning a stored media record into something an `<img>` can point at.
 *
 * ── WHY BLOBS AND NOT DATA URLS ───────────────────────────────────────────────────────────────
 *
 * v0.1 stored every photograph as a base64 data URL. That is three separate costs stacked on one
 * another, and all three are paid on a device the user already owns:
 *
 *  1. **+33% on disk.** Base64 encodes three bytes into four characters, and IndexedDB then stores
 *     that as UTF-16.
 *  2. **The whole library resident in the JS heap.** A data URL is a *string*: loading the media
 *     table means every photograph's bytes are live objects. A `Blob` is a handle to storage the
 *     browser keeps out of the heap, so the same table becomes a list of references.
 *  3. **Decode on every read.** The browser re-parses the base64 each time the URL is assigned.
 *
 * The arithmetic that made this urgent: the face-variety gate *requires* several photographs per
 * person from distinct encounters, so a real second year is on the order of 200 people × 4 images.
 * At ~65 kB of base64 each that is 50–65 MB of live strings, re-parsed on every launch. Invisible
 * during development, because the demo generator draws synthetic SVG faces and never allocates a
 * single photograph.
 *
 * ── OBJECT URLS LEAK BY DESIGN ────────────────────────────────────────────────────────────────
 *
 * `URL.createObjectURL` pins its Blob until `revokeObjectURL` is called — the browser cannot know
 * you are finished. Minting one per render would leak the entire library within a session, so they
 * are cached by media id here and handed out repeatedly.
 */

const urls = new Map<string, string>()

/** A URL for an `<img src>`. Stable per media id, so React never sees it change. */
export function mediaSrc(ref: MediaRef): string {
  const cached = urls.get(ref.id)
  if (cached) return cached
  if (ref.blob) {
    const url = URL.createObjectURL(ref.blob)
    urls.set(ref.id, url)
    return url
  }
  // Legacy records written before v2. Still perfectly displayable; migration rewrites them in the
  // background, and until it does they cost nothing extra to show.
  return ref.src ?? ''
}

/** Release one media id's URL — used by the cascade delete, so a wipe actually frees memory. */
export function releaseMedia(id: string): void {
  const url = urls.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urls.delete(id)
  }
}

export function releaseAllMedia(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
}

/** Data URL → Blob, without a network round trip. Used by the v1 → v2 migration and by import. */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) return null
  const [, type = 'application/octet-stream', base64, payload] = match
  try {
    if (!base64) return new Blob([decodeURIComponent(payload)], { type })
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type })
  } catch {
    return null
  }
}

/** Blob → data URL. Only used by export, which has to produce a single portable JSON file. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
