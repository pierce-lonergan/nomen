import type { Person } from '../types'

/**
 * Interference sets — clustering the names on your own roster that compete with each other.
 *
 * ── WHY THIS IS A DRILL AT ALL ────────────────────────────────────────────────────────────────
 *
 * Learning many similar names creates proactive interference, and retrieving one name can actively
 * suppress its competitors. The counter-intuitive finding is that the remedy is *more retrieval*,
 * not less exposure: testing has been shown to protect against proactive interference in face–name
 * learning. So the right response to "I keep mixing up Marek and Marius" is to test them together
 * on purpose, which is the opposite of what most people do.
 *
 * The clustering has to run on the user's OWN roster. A generic list of confusable names is not
 * the point — the interference is between the specific people you actually know.
 *
 * ── WHY NOT SOUNDEX ───────────────────────────────────────────────────────────────────────────
 *
 * Soundex was designed in 1918 for American surnames on census cards. It keeps the first letter
 * verbatim, which means *Kirsten* and *Carsten* never collide however alike they sound, and it
 * throws away all vowels, which makes *Marek* and *Mirko* identical when they are not confusable
 * at all. This app's roster is deliberately international.
 *
 * What is used instead is a small phonetic reduction — collapse the consonant classes that
 * genuinely neutralise in speech, keep a coarse vowel skeleton — combined with an edit distance on
 * the reduction. That catches onset-sharing pairs (Marek/Marius), rhyme-sharing pairs
 * (Sofia/Nadia) and near-homophones (Kirsten/Carsten) without collapsing everything beginning with
 * M into one bucket.
 */

/** Consonant classes that neutralise often enough in speech to matter for confusion. */
const CLASSES: [RegExp, string][] = [
  [/[àáâãäå]/g, 'a'], [/[èéêë]/g, 'e'], [/[ìíîï]/g, 'i'], [/[òóôõö]/g, 'o'], [/[ùúûü]/g, 'u'],
  [/[ç]/g, 's'], [/[ñ]/g, 'n'], [/[ß]/g, 's'],
  [/ph/g, 'f'], [/gh/g, 'g'], [/ck/g, 'k'], [/sch/g, 'S'], [/sh/g, 'S'], [/ch/g, 'S'],
  [/th/g, 't'], [/[cq]/g, 'k'], [/x/g, 'ks'], [/[vw]/g, 'v'], [/[jy]/g, 'i'], [/z/g, 's'],
]

/** Vowels reduce to a single class: the vowel *pattern* matters, its exact quality mostly does not. */
const VOWEL = /[aeiou]/g

export function phoneticKey(name: string): string {
  let s = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  s = s.replace(/[^a-z]/g, '')
  for (const [re, to] of CLASSES) s = s.replace(re, to)
  // Collapse doubled letters: Anna and Ana are the same name said aloud.
  s = s.replace(/(.)\1+/g, '$1')
  return s
}

/** The consonant skeleton, which carries most of the identity of a spoken name. */
export function consonantSkeleton(name: string): string {
  return phoneticKey(name).replace(VOWEL, '')
}

/** Levenshtein, small strings only. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]
}

/**
 * Do two names compete?
 *
 * Three routes, because names collide in three different ways and any one alone misses two thirds
 * of the real confusions:
 *   · near-identical reduction — Kirsten / Carsten
 *   · shared onset and length — Marek / Marius, the classic "I know it starts with Mar"
 *   · shared consonant skeleton — Nadia / Nadya
 */
export function competes(a: string, b: string): boolean {
  const ka = phoneticKey(a)
  const kb = phoneticKey(b)
  if (!ka || !kb || ka === kb) return ka === kb && ka.length > 0

  const distance = editDistance(ka, kb)
  const longer = Math.max(ka.length, kb.length)
  if (distance <= Math.max(1, Math.floor(longer * 0.25))) return true

  const onset = ka.slice(0, 3) === kb.slice(0, 3) && Math.abs(ka.length - kb.length) <= 2
  if (onset && ka.length >= 3) return true

  const sa = consonantSkeleton(a)
  const sb = consonantSkeleton(b)
  return sa.length >= 2 && sa === sb
}

export interface InterferenceCluster {
  /** The shared thing, for the UI to name: the common onset, or the skeleton. */
  label: string
  members: Person[]
}

/** Smaller than this is not a set — one name has nothing to be confused with. */
export const MIN_CLUSTER = 2

/**
 * Cluster a roster into competing sets.
 *
 * Single-link agglomeration: a name joins a cluster if it competes with *any* member. That is the
 * right shape here — interference is pairwise and transitive in practice, because if you mix up
 * Marek with Marius and Marius with Mario, all three are one problem, not two.
 */
export function interferenceClusters(people: Person[]): InterferenceCluster[] {
  const candidates = people.filter((p) => p.status === 'ACTIVE' && p.givenName.trim().length > 1)
  const clusters: Person[][] = []

  for (const person of candidates) {
    const hit = clusters.find((c) => c.some((m) => competes(m.givenName, person.givenName)))
    if (hit) hit.push(person)
    else clusters.push([person])
  }

  return clusters
    .filter((c) => c.length >= MIN_CLUSTER)
    .map((members) => {
      const keys = members.map((m) => phoneticKey(m.givenName))
      let shared = keys[0]
      for (const k of keys.slice(1)) {
        let i = 0
        while (i < shared.length && i < k.length && shared[i] === k[i]) i++
        shared = shared.slice(0, i)
      }
      return {
        label: shared.length >= 2 ? `${shared}…` : consonantSkeleton(members[0].givenName),
        members: [...members].sort((a, b) => a.givenName.localeCompare(b.givenName)),
      }
    })
    // Biggest tangle first: that is the one actually costing the user something.
    .sort((a, b) => b.members.length - a.members.length)
}

/** The cluster a person belongs to, if any. Used to draw same-cluster foils for a four-choice cue. */
export function clusterFor(person: Person, people: Person[]): Person[] {
  const cluster = interferenceClusters(people).find((c) => c.members.some((m) => m.id === person.id))
  return cluster ? cluster.members.filter((m) => m.id !== person.id) : []
}
