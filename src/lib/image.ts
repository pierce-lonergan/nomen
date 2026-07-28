/**
 * Image handling.
 *
 * Photos are downscaled on-device before storage: a name-memory app does not need 12-megapixel
 * portraits, and the smaller the stored blob the less there is to leak if the device is lost.
 * Nothing here uploads anything — there is no network code in this file or anywhere near it.
 */

const MAX_EDGE = 512
const QUALITY = 0.82

export async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', QUALITY)
}

export async function filesToDataUrls(files: FileList | null): Promise<string[]> {
  if (!files) return []
  return Promise.all(Array.from(files).map(fileToDownscaledDataUrl))
}
