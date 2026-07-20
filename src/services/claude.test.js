import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkEmergency, generateSubwayGuide, parseUserQuery } from './claude.js'

describe('checkEmergency', () => {
  it('flags common emergency phrases', () => {
    expect(checkEmergency('갑자기 가슴이 아파요')).toBe(true)
    expect(checkEmergency('119 불러줘')).toBe(true)
    expect(checkEmergency('어지럽고 힘들어요')).toBe(true)
    expect(checkEmergency('넘어졌어요')).toBe(true)
  })

  it('does not flag ordinary destination queries', () => {
    expect(checkEmergency('종로구청 가는 길 알려줘')).toBe(false)
    expect(checkEmergency('병원 가고 싶어요')).toBe(false)
  })
})

// parseUserQuery / generateSubwayGuide call /api/claude first; with fetch stubbed to
// always reject, they exercise the same offline fallback path the app relies on
// when the AI proxy is unavailable.
describe('parseUserQuery (offline fallback)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('infers destination type from keywords', async () => {
    expect((await parseUserQuery('병원 가고 싶어요', {})).destinationType).toBe('hospital')
    expect((await parseUserQuery('약국 좀 들렀다 갈래요', {})).destinationType).toBe('pharmacy')
    expect((await parseUserQuery('복지관 가는 길', {})).destinationType).toBe('welfare')
  })

  it('normalizes home-related queries to a fixed destination', async () => {
    const result = await parseUserQuery('집으로 갈래요', {})
    expect(result.destination).toBe('집')
    expect(result.destinationType).toBe('home')
  })

  it('turns profile mobility settings into route preferences', async () => {
    const result = await parseUserQuery('아무데나', {
      allowStairs: false,
      preferElevator: true,
      preferLowFloorBus: true,
    })
    expect(result.preferences).toEqual(
      expect.arrayContaining(['계단 없음', '승강기 우선', '저상버스 우선'])
    )
  })
})

describe('generateSubwayGuide (offline fallback)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('matches well-known destinations to their nearest station', async () => {
    expect((await generateSubwayGuide('강남역 근처 약속')).nearestStation).toBe('강남역')
    expect((await generateSubwayGuide('홍대입구에서 보자')).nearestStation).toBe('홍대입구역')
  })

  it('falls back to Seoul station for unrecognized destinations', async () => {
    expect((await generateSubwayGuide('아무도 모르는 동네')).nearestStation).toBe('서울역')
  })
})
