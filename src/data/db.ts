import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  AssessmentResult,
  Attempt,
  DayRecord,
  MediaRef,
  Mission,
  Moment,
  Person,
  ScheduleItem,
  Settings,
} from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'
import { blobToDataUrl, dataUrlToBlob, releaseMedia } from '../lib/media'

/**
 * Local persistence.
 *
 * Everything lives on the device. There is no sync layer, no account, and no code path that
 * transmits a record anywhere — the database is a file of photographs, voice clips, and private
 * notes about real people who never agreed to be uploaded to anything. See docs/06-privacy.md.
 */

const DB_NAME = 'nomen'

/**
 * v2: photographs are stored as `Blob` rather than as base64 data URLs. See `src/lib/media.ts` for
 * the arithmetic. Existing records are migrated lazily by `migrateLegacyMedia()` rather than in
 * the upgrade transaction, because an IndexedDB upgrade must not await anything that is not part
 * of the transaction — a blocked upgrade wedges every tab the user has open.
 */
const DB_VERSION = 2

interface NomenDB extends DBSchema {
  people: { key: string; value: Person; indexes: { status: string; track: string } }
  media: { key: string; value: MediaRef; indexes: { personId: string } }
  items: { key: string; value: ScheduleItem; indexes: { due: number; subjectId: string } }
  attempts: { key: string; value: Attempt; indexes: { at: number; subjectId: string } }
  days: { key: string; value: DayRecord }
  missions: { key: string; value: Mission }
  moments: { key: string; value: Moment }
  assessments: { key: string; value: AssessmentResult }
  settings: { key: string; value: Settings }
}

export type StoreName =
  | 'people'
  | 'media'
  | 'items'
  | 'attempts'
  | 'days'
  | 'missions'
  | 'moments'
  | 'assessments'

let dbPromise: Promise<IDBPDatabase<NomenDB>> | null = null

export function db(): Promise<IDBPDatabase<NomenDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NomenDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        // Guarded per-store, not per-version-number. An unguarded createObjectStore throws
        // ConstraintError against any database that already has it, which on a released app means
        // every existing user is greeted by a crash instead of an upgrade.
        if (!database.objectStoreNames.contains('people')) {
          const people = database.createObjectStore('people', { keyPath: 'id' })
          people.createIndex('status', 'status')
          people.createIndex('track', 'track')
        }
        if (!database.objectStoreNames.contains('media')) {
          const media = database.createObjectStore('media', { keyPath: 'id' })
          media.createIndex('personId', 'personId')
        }
        if (!database.objectStoreNames.contains('items')) {
          const items = database.createObjectStore('items', { keyPath: 'id' })
          items.createIndex('due', 'due')
          items.createIndex('subjectId', 'subjectId')
        }
        if (!database.objectStoreNames.contains('attempts')) {
          const attempts = database.createObjectStore('attempts', { keyPath: 'id' })
          attempts.createIndex('at', 'at')
          attempts.createIndex('subjectId', 'subjectId')
        }
        for (const name of ['days', 'missions', 'moments', 'assessments'] as const) {
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name, { keyPath: name === 'days' ? 'day' : 'id' })
          }
        }
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings')
        }
        void oldVersion
      },
      blocked() {
        // Another tab is holding the old version open. Silent failure here looks like a hang.
        console.warn('nomen: database upgrade blocked by another open tab')
      },
    })
  }
  return dbPromise
}

export async function loadSettings(): Promise<Settings> {
  const stored = await (await db()).get('settings', 'current')
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await db()).put('settings', settings, 'current')
}

export async function putAll<K extends StoreName>(store: K, values: NomenDB[K]['value'][]): Promise<void> {
  if (values.length === 0) return
  const database = await db()
  const tx = database.transaction(store, 'readwrite')
  await Promise.all(values.map((v) => tx.store.put(v as never)))
  await tx.done
}

/** One write, spanning several stores. */
export type Write = { [K in StoreName]: { store: K; values: NomenDB[K]['value'][] } }[StoreName]

/**
 * Write to several stores **atomically**.
 *
 * Grading a card touches items, attempts, days and sometimes missions. Issuing those as four
 * separate `putAll` calls is four separate transactions, and a crash, a tab close or a quota error
 * between any two of them leaves the database internally inconsistent — most often an attempt
 * recorded against an item whose interval never advanced, which silently corrupts both the
 * schedule and the recall metrics with no error anywhere.
 *
 * IndexedDB gives atomicity for free as long as the writes share one transaction. They now do.
 */
export async function transact(writes: Write[]): Promise<void> {
  const active = writes.filter((w) => w.values.length > 0)
  if (active.length === 0) return
  const database = await db()
  const names = [...new Set(active.map((w) => w.store))]
  const tx = database.transaction(names, 'readwrite')
  await Promise.all(
    active.flatMap((w) => w.values.map((v) => tx.objectStore(w.store).put(v as never))),
  )
  await tx.done
}

/**
 * Hard cascade delete. No trash, no soft-delete flag, no "recently deleted" — when the user says
 * remove this person, the person's photos, voice clips, schedule, and history all go immediately.
 */
export async function deletePersonCascade(personId: string): Promise<void> {
  const database = await db()
  const tx = database.transaction(['people', 'media', 'items', 'attempts'], 'readwrite')
  await tx.objectStore('people').delete(personId)

  const range = IDBKeyRange.only(personId)
  for await (const cursor of tx.objectStore('media').index('personId').iterate(range)) {
    // Revoke before deleting: an object URL keeps its Blob alive, so a delete that skips this
    // frees the record and pins the bytes for the rest of the session.
    releaseMedia(cursor.value.id)
    await cursor.delete()
  }
  for await (const cursor of tx.objectStore('items').index('subjectId').iterate(range)) {
    await cursor.delete()
  }
  for await (const cursor of tx.objectStore('attempts').index('subjectId').iterate(range)) {
    await cursor.delete()
  }
  await tx.done
}

/**
 * Rewrite base64 media as Blobs, a slice at a time.
 *
 * Deliberately outside the upgrade transaction and deliberately incremental: a user with a year of
 * photographs should not meet a multi-second freeze on the launch after an update. Anything not
 * yet converted still displays, because `mediaSrc()` falls back to the legacy string.
 */
export async function migrateLegacyMedia(limit = 40): Promise<number> {
  const database = await db()
  const all = await database.getAll('media')
  const legacy = all.filter((m) => !m.blob && typeof m.src === 'string' && m.src.startsWith('data:'))
  if (legacy.length === 0) return 0

  const batch = legacy.slice(0, limit)
  const converted: MediaRef[] = []
  for (const ref of batch) {
    const blob = dataUrlToBlob(ref.src!)
    // A record that will not convert is left exactly as it is. Dropping it would destroy a
    // photograph of a real person to tidy up a storage format.
    if (blob) converted.push({ ...ref, blob, src: undefined })
  }
  await putAll('media', converted)
  return legacy.length - converted.length
}

// ── Export / import ───────────────────────────────────────────────────────────

export interface ExportBundle {
  version: number
  exportedAt: number
  people: Person[]
  media: MediaRef[]
  items: ScheduleItem[]
  attempts: Attempt[]
  days: DayRecord[]
  missions: Mission[]
  moments: Moment[]
  assessments: AssessmentResult[]
  settings: Settings
}

/**
 * A portable JSON file.
 *
 * Blobs are re-encoded as data URLs on the way out, because the export has to survive
 * `JSON.stringify` and land somewhere the user controls. This is the one place base64 is correct:
 * the cost is paid once, by choice, for a file that leaves the app.
 */
export async function exportAll(now: number): Promise<ExportBundle> {
  const d = await db()
  const media = await d.getAll('media')
  const portable = await Promise.all(
    media.map(async (m) => (m.blob ? { ...m, src: await blobToDataUrl(m.blob), blob: undefined } : m)),
  )
  return {
    version: DB_VERSION,
    exportedAt: now,
    people: await d.getAll('people'),
    media: portable,
    items: await d.getAll('items'),
    attempts: await d.getAll('attempts'),
    days: await d.getAll('days'),
    missions: await d.getAll('missions'),
    moments: await d.getAll('moments'),
    assessments: await d.getAll('assessments'),
    settings: await loadSettings(),
  }
}

export class ImportError extends Error {}

/**
 * Check a bundle before touching the database.
 *
 * The previous version read nothing — not even the `version` field it wrote — validated nothing,
 * and ran eight independent transactions. A truncated file, a bundle from a future schema, or a
 * JSON file that was never an export at all would half-import and leave the database in a state
 * with no undo, because this app deliberately has no trash.
 */
export function validateBundle(raw: unknown): ExportBundle {
  if (!raw || typeof raw !== 'object') throw new ImportError('That file is not a Nomen export.')
  const b = raw as Partial<ExportBundle>

  if (typeof b.version !== 'number') {
    throw new ImportError('That file has no version stamp, so it is not a Nomen export.')
  }
  if (b.version > DB_VERSION) {
    throw new ImportError(
      `That export was written by a newer version of Nomen (format ${b.version}, this build reads ${DB_VERSION}). Importing it could silently drop fields, so it is refused.`,
    )
  }

  const arrays: (keyof ExportBundle)[] = [
    'people', 'media', 'items', 'attempts', 'days', 'missions', 'moments', 'assessments',
  ]
  for (const key of arrays) {
    if (!Array.isArray(b[key])) throw new ImportError(`That export is missing its "${key}" records.`)
  }
  if (!b.settings || typeof b.settings !== 'object') {
    throw new ImportError('That export is missing its settings.')
  }

  // Spot-check the shape of the two records everything else hangs off, so a JSON file that happens
  // to have the right keys still cannot get in.
  for (const p of b.people as Person[]) {
    if (typeof p?.id !== 'string' || typeof p?.displayName !== 'string') {
      throw new ImportError('That export contains a person record with no id or name.')
    }
  }
  for (const i of b.items as ScheduleItem[]) {
    if (typeof i?.id !== 'string' || typeof i?.subjectId !== 'string') {
      throw new ImportError('That export contains a schedule item with no id or subject.')
    }
  }

  return b as ExportBundle
}

/**
 * Replace everything, in ONE transaction.
 *
 * All-or-nothing matters more here than anywhere else in the app: a half-applied import against a
 * database with no trash is unrecoverable.
 */
export async function importAll(bundle: ExportBundle): Promise<void> {
  const valid = validateBundle(bundle)

  // Re-hydrate any data-URL media straight to Blob so an import never re-introduces the old format.
  const media = valid.media.map((m) => {
    if (m.blob || typeof m.src !== 'string' || !m.src.startsWith('data:')) return m
    const blob = dataUrlToBlob(m.src)
    return blob ? { ...m, blob, src: undefined } : m
  })

  const database = await db()
  const stores: StoreName[] = ['people', 'media', 'items', 'attempts', 'days', 'missions', 'moments', 'assessments']
  const tx = database.transaction([...stores, 'settings'], 'readwrite')
  const payload: Record<StoreName, unknown[]> = {
    people: valid.people,
    media,
    items: valid.items,
    attempts: valid.attempts,
    days: valid.days,
    missions: valid.missions,
    moments: valid.moments,
    assessments: valid.assessments,
  }
  for (const name of stores) {
    const store = tx.objectStore(name)
    await store.clear()
    for (const value of payload[name]) await store.put(value as never)
  }
  await tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...valid.settings }, 'current')
  await tx.done
}

/** Wipe everything. Used by the privacy screen; deliberately not undoable. */
export async function wipeAll(): Promise<void> {
  const d = await db()
  const stores = ['people', 'media', 'items', 'attempts', 'days', 'missions', 'moments', 'assessments', 'settings'] as const
  const tx = d.transaction(stores, 'readwrite')
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()))
  await tx.done
}
