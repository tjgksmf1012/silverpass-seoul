import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_FAVORITES,
  addHistory,
  createDefaultProfile,
  createFavoritePlace,
  getHistory,
  getProfile,
  isFirstVisit,
  markVisited,
  normalizeFavorites,
  saveProfile,
} from './storage.js'

beforeEach(() => {
  localStorage.clear()
})

describe('isFirstVisit / markVisited', () => {
  it('is true until markVisited is called', () => {
    expect(isFirstVisit()).toBe(true)
    markVisited()
    expect(isFirstVisit()).toBe(false)
  })
})

describe('createDefaultProfile', () => {
  it('fills in defaults and normalizes favorites', () => {
    const profile = createDefaultProfile()
    expect(profile.district).toBe('종로구')
    expect(profile.maxWalkMin).toBe(20)
    expect(profile.favorites).toHaveLength(DEFAULT_FAVORITES.length)
  })

  it('merges overrides on top of defaults', () => {
    const profile = createDefaultProfile({ name: '홍길동', maxWalkMin: 10 })
    expect(profile.name).toBe('홍길동')
    expect(profile.maxWalkMin).toBe(10)
    expect(profile.district).toBe('종로구')
  })
})

describe('createFavoritePlace', () => {
  it('assigns a generated id and sensible defaults', () => {
    const place = createFavoritePlace()
    expect(place.id).toMatch(/^custom_/)
    expect(place.name).toBe('새 장소')
    expect(place.custom).toBe(true)
    expect(place.showOnHome).toBe(true)
  })

  it('keeps provided overrides', () => {
    const place = createFavoritePlace({ name: '단골 약국', address: '서울 종로구' })
    expect(place.name).toBe('단골 약국')
    expect(place.address).toBe('서울 종로구')
  })
})

describe('normalizeFavorites', () => {
  it('returns the four default slots when given an empty list', () => {
    const result = normalizeFavorites([])
    expect(result).toHaveLength(4)
    expect(result.map(f => f.name)).toEqual(['복지관', '병원', '약국', '집'])
    expect(result.every(f => f.custom === false)).toBe(true)
  })

  it('overrides a default slot in place instead of duplicating it', () => {
    const result = normalizeFavorites([{ id: 2, name: '병원', address: '서울 강남구 OO병원' }])
    expect(result).toHaveLength(4)
    expect(result[1]).toMatchObject({ id: 2, name: '병원', address: '서울 강남구 OO병원' })
  })

  it('appends unknown ids as custom favorites after the defaults', () => {
    const result = normalizeFavorites([{ id: 'x1', name: '단골 카페', address: '서울 종로구 1' }])
    expect(result).toHaveLength(5)
    expect(result[4]).toMatchObject({ id: 'x1', name: '단골 카페', custom: true })
  })
})

describe('getProfile / saveProfile', () => {
  it('round-trips a saved profile', () => {
    saveProfile(createDefaultProfile({ name: '홍길동', homeAddress: '서울 종로구' }))
    const loaded = getProfile()
    expect(loaded.name).toBe('홍길동')
    expect(loaded.homeAddress).toBe('서울 종로구')
  })

  it('falls back to defaults when storage has invalid JSON', () => {
    localStorage.setItem('silverpass_profile', '{not valid json')
    const loaded = getProfile()
    expect(loaded.district).toBe('종로구')
  })
})

describe('addHistory / getHistory', () => {
  it('records a valid destination', () => {
    addHistory({ destination: '강남역' })
    const history = getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].destination).toBe('강남역')
    expect(history[0].timestamp).toBeTypeOf('number')
  })

  it('ignores placeholder destinations', () => {
    addHistory({ destination: '목적지' })
    addHistory({ destination: '알 수 없음' })
    expect(getHistory()).toHaveLength(0)
  })

  it('strips the "X 바로 이동" wrapper from a destination', () => {
    addHistory({ destination: '"강남역" 바로 이동' })
    expect(getHistory()[0].destination).toBe('강남역')
  })

  it('moves a repeated destination back to the front instead of duplicating it', () => {
    addHistory({ destination: '강남역' })
    addHistory({ destination: '종로구청' })
    addHistory({ destination: '강남역' })
    const history = getHistory()
    expect(history).toHaveLength(2)
    expect(history[0].destination).toBe('강남역')
  })

  it('keeps only the most recent 20 entries', () => {
    for (let i = 0; i < 25; i += 1) {
      addHistory({ destination: `목적지-${i}` })
    }
    const history = getHistory()
    expect(history).toHaveLength(20)
    expect(history[0].destination).toBe('목적지-24')
  })
})
