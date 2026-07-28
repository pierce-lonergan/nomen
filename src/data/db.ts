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

/**
 * Local persistence.
 *
 * Everything lives on the device. There is no sync layer, no account, and no code path that
 * transmits a record anywhere — the database is a file of photographs, voice clips, and private
 * notes about real people who never agreed to be uploaded to anything. See docs/06-privacy.md.
 */

const DB_NAME = 'nomen'
const DB_VERSION = 1

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

let dbPromise: Promise<IDBPDatabase<NomenDB>> | null = null

export function db(): Promise<IDBPDatabase<NomenDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NomenDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const people = database.createObjectStore('people', { keyPath: 'id' })
        people.createIndex('status', 'status')
        people.createIndex('track', 'track')

        const media = database.createObjectStore('media', { keyPath: 'id' })
        media.createIndex('personId', 'personId')

        const items = database.createObjectStore('items', { keyPath: 'id' })
        items.createIndex('due', 'due')
        items.createIndex('subjectId', 'subjectId')

        const attempts = database.createObjectStore('attempts', { keyPath: 'id' })
        attempts.createIndex('at', 'at')
        attempts.createIndex('subjectId', 'subjectId')

        database.createObjectStore('days', { keyPath: 'day' })
        database.createObjectStore('missions', { keyPath: 'id' })
        database.createObjectStore('moments', { keyPath: 'id' })
        database.createObjectStore('assessments', { keyPath: 'id' })
        database.createObjectStore('settings')
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

export async function putAll<K extends 'people' | 'items' | 'attempts' | 'media' | 'days' | 'missions' | 'moments' | 'assessments'>(
  store: K,
  values: NomenDB[K]['value'][],
): Promise<void> {
  const database = await db()
  const tx = database.transaction(store, 'readwrite')
  await Promise.all(values.map((v) => tx.store.put(v as never)))
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

export async function exportAll(now: number): Promise<ExportBundle> {
  const d = await db()
  return {
    version: DB_VERSION,
    exportedAt: now,
    people: await d.getAll('people'),
    media: await d.getAll('media'),
    items: await d.getAll('items'),
    attempts: await d.getAll('attempts'),
    days: await d.getAll('days'),
    missions: await d.getAll('missions'),
    moments: await d.getAll('moments'),
    assessments: await d.getAll('assessments'),
    settings: await loadSettings(),
  }
}

export async function importAll(bundle: ExportBundle): Promise<void> {
  await putAll('people', bundle.people)
  await putAll('media', bundle.media)
  await putAll('items', bundle.items)
  await putAll('attempts', bundle.attempts)
  await putAll('days', bundle.days)
  await putAll('missions', bundle.missions)
  await putAll('moments', bundle.moments)
  await putAll('assessments', bundle.assessments)
  await saveSettings(bundle.settings)
}

/** Wipe everything. Used by the privacy screen; deliberately not undoable. */
export async function wipeAll(): Promise<void> {
  const d = await db()
  const stores = ['people', 'media', 'items', 'attempts', 'days', 'missions', 'moments', 'assessments', 'settings'] as const
  const tx = d.transaction(stores, 'readwrite')
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()))
  await tx.done
}
