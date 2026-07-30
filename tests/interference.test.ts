import { describe, expect, it } from 'vitest'
import {
  MIN_CLUSTER,
  clusterFor,
  competes,
  consonantSkeleton,
  editDistance,
  interferenceClusters,
  phoneticKey,
} from '../src/domain/drills/interference'
import type { Person } from '../src/domain/types'

function person(givenName: string, over: Partial<Person> = {}): Person {
  return {
    id: `id-${givenName}`,
    track: 'PERSON',
    displayName: givenName,
    givenName,
    metAt: 0,
    likelihoodOfMeetingAgain: 'MEDIUM',
    status: 'ACTIVE',
    highValue: false,
    encounters: [],
    imageMediaIds: [],
    voiceMediaIds: [],
    ...over,
  }
}

describe('the phonetic reduction', () => {
  it('collapses spellings of the same sound', () => {
    expect(phoneticKey('Philip')).toBe(phoneticKey('Filip'))
    expect(phoneticKey('Katherine')).toBe(phoneticKey('Catherine'))
    expect(phoneticKey('Anna')).toBe(phoneticKey('Ana'))
    expect(phoneticKey('Mikael')).toBe(phoneticKey('Mykael'))
  })

  it('strips diacritics, because the roster is international by design', () => {
    expect(phoneticKey('Inés')).toBe(phoneticKey('Ines'))
    expect(phoneticKey('Sørina'.replace('ø', 'o'))).toBe(phoneticKey('Sorina'))
    expect(phoneticKey('Zoë')).toBe(phoneticKey('Zoe'))
  })

  it('does NOT keep the first letter verbatim, which is where Soundex fails', () => {
    // Soundex preserves the initial letter, so these never collide however alike they sound.
    expect(competes('Kirsten', 'Carsten')).toBe(true)
    expect(competes('Katia', 'Catia')).toBe(true)
  })

  it('keeps a vowel skeleton, so names that merely share consonants stay apart', () => {
    // Soundex drops vowels entirely and would make these identical. They are not confusable.
    expect(phoneticKey('Marek')).not.toBe(phoneticKey('Mirko'))
  })

  it('reduces to a consonant skeleton on demand', () => {
    expect(consonantSkeleton('Nadia')).toBe(consonantSkeleton('Nadya'))
  })
})

describe('edit distance', () => {
  it('is zero for identical strings and symmetric', () => {
    expect(editDistance('marek', 'marek')).toBe(0)
    expect(editDistance('marek', 'marius')).toBe(editDistance('marius', 'marek'))
  })

  it('handles empty input', () => {
    expect(editDistance('', 'abc')).toBe(3)
    expect(editDistance('abc', '')).toBe(3)
  })
})

describe('which names actually compete', () => {
  it('catches shared onsets — the "I know it starts with Mar" failure', () => {
    expect(competes('Marek', 'Marius')).toBe(true)
    expect(competes('Sofia', 'Sofie')).toBe(true)
  })

  it('catches near-homophones', () => {
    expect(competes('Nadia', 'Nadya')).toBe(true)
    expect(competes('Jon', 'Yon')).toBe(true)
  })

  it('leaves genuinely distinct names alone', () => {
    expect(competes('Marek', 'Priya')).toBe(false)
    expect(competes('Kwame', 'Beatriz')).toBe(false)
    expect(competes('Idris', 'Naledi')).toBe(false)
  })

  it('is symmetric — interference has no direction', () => {
    const pairs: [string, string][] = [
      ['Marek', 'Marius'], ['Marek', 'Priya'], ['Kirsten', 'Carsten'], ['Sven', 'Owen'],
    ]
    for (const [a, b] of pairs) expect(competes(a, b)).toBe(competes(b, a))
  })

  it('does not consider a one-letter name a competitor of everything', () => {
    expect(competes('A', 'Amara')).toBe(false)
  })
})

describe('clustering a real roster', () => {
  const roster = [
    person('Marek'), person('Marius'), person('Mario'),
    person('Sofia'), person('Sofie'),
    person('Priya'), person('Kwame'), person('Beatriz'),
  ]

  it('finds the tangles and leaves the singletons out', () => {
    const clusters = interferenceClusters(roster)
    const names = clusters.map((c) => c.members.map((m) => m.givenName).sort())
    expect(names).toContainEqual(['Mareк'.replace('к', 'k'), 'Mario', 'Marius'])
    expect(names).toContainEqual(['Sofia', 'Sofie'])
    // Priya, Kwame and Beatriz compete with nobody, so they are not a set.
    expect(clusters.flatMap((c) => c.members.map((m) => m.givenName))).not.toContain('Priya')
  })

  it('never emits a cluster below the minimum — one name is not a set', () => {
    for (const c of interferenceClusters(roster)) {
      expect(c.members.length).toBeGreaterThanOrEqual(MIN_CLUSTER)
    }
  })

  it('puts the biggest tangle first, because that is the one costing something', () => {
    const clusters = interferenceClusters(roster)
    for (let i = 1; i < clusters.length; i++) {
      expect(clusters[i - 1].members.length).toBeGreaterThanOrEqual(clusters[i].members.length)
    }
  })

  it('groups transitively — one tangle, not two overlapping pairs', () => {
    const clusters = interferenceClusters([person('Marek'), person('Marius'), person('Mario')])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].members).toHaveLength(3)
  })

  it('ignores roster and archived people — you are not tested against them', () => {
    const mixed = [
      person('Marek'),
      person('Marius', { status: 'ROSTER' }),
      person('Mario', { status: 'ARCHIVED' }),
    ]
    expect(interferenceClusters(mixed)).toHaveLength(0)
  })

  it('survives an empty roster and a roster of one', () => {
    expect(interferenceClusters([])).toEqual([])
    expect(interferenceClusters([person('Solo')])).toEqual([])
  })

  it('hands back a person\'s competitors, excluding themselves', () => {
    const marek = roster[0]
    const rivals = clusterFor(marek, roster).map((p) => p.givenName)
    expect(rivals).toEqual(expect.arrayContaining(['Marius', 'Mario']))
    expect(rivals).not.toContain('Marek')
  })

  it('returns nothing for someone who competes with nobody', () => {
    expect(clusterFor(person('Priya'), roster)).toEqual([])
  })

  it('is deterministic', () => {
    expect(interferenceClusters(roster)).toEqual(interferenceClusters(roster))
  })
})
