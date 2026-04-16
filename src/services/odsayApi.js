/**
 * ODsay LAB 대중교통 API 연동
 * https://lab.odsay.com
 *
 * - searchPubTransPathT : 출발→도착 좌표 기반 대중교통 경로 탐색
 * - realtimeInfo        : 버스 실시간 도착 정보
 *
 * ODsay는 HTTPS API이므로 브라우저에서 직접 호출 가능
 * (등록된 도메인: localhost:5173, silverpass-seoul.vercel.app)
 */

const API_KEY = import.meta.env.VITE_ODSAY_API_KEY?.trim()
const BASE = 'https://api.odsay.com/v1/api'

// trafficType 숫자 → 텍스트
const TRAFFIC_TYPE = { 1: 'subway', 2: 'bus', 3: 'walk' }
// pathType → 텍스트
const PATH_TYPE = { 1: '지하철', 2: '버스', 3: '버스+지하철' }

const BUS_TYPE_LABEL = {
  1: '직행좌석', 2: '좌석', 3: '마을', 4: '간선', 5: '지선',
  6: '순환', 7: '광역', 8: '농어촌', 9: '경기순환', 10: '급행',
  11: '간선', 12: '지선', 13: '순환', 14: '광역', 15: '급행간선',
}

// ─── 경로 탐색 ────────────────────────────────────────────────────────────────
/**
 * @param {number} sx 출발지 경도 (lng)
 * @param {number} sy 출발지 위도 (lat)
 * @param {number} ex 목적지 경도 (lng)
 * @param {number} ey 목적지 위도 (lat)
 * @returns {TransitRoute[]}
 */
export async function searchTransitRoute(sx, sy, ex, ey) {
  if (!API_KEY) return null

  try {
    const key = encodeURIComponent(API_KEY)
    const url = `${BASE}/searchPubTransPathT?SX=${sx}&SY=${sy}&EX=${ex}&EY=${ey}&apiKey=${key}&lang=0&output=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = await res.json()

    const paths = json?.result?.path
    if (!paths?.length) return null

    // 최대 3개 경로 파싱
    return paths.slice(0, 3).map(parsePath)
  } catch (e) {
    console.warn('ODsay route error:', e)
    return null
  }
}

function parsePath(path) {
  const info = path.info || {}
  const subPaths = path.subPath || []

  // 이동 수단 섹션만 추출 (도보 제외)
  const transitSteps = subPaths
    .filter(s => s.trafficType !== 3)
    .map(s => {
      if (s.trafficType === 2) {
        // 버스
        const lanes = s.lane || []
        return {
          type: 'bus',
          lines: lanes.map(l => ({
            busNo: l.busNo,
            busId: l.busID,
            typeLabel: BUS_TYPE_LABEL[l.type] || '버스',
            isLowFloor: false, // ODsay에서 직접 제공 안 함
          })),
          startName: s.startName || '',
          endName: s.endName || '',
          stationCount: s.stationCount || 0,
          sectionTime: s.sectionTime || 0,
          startStationId: s.passStopList?.stations?.[0]?.stationID || null,
          startStationName: s.passStopList?.stations?.[0]?.stationName || s.startName || '',
        }
      } else {
        // 지하철
        const lanes = s.lane || []
        return {
          type: 'subway',
          lines: lanes.map(l => ({
            subwayCode: l.subwayCode,
            name: l.name,
            color: subwayColor(l.subwayCode),
          })),
          startName: s.startName || '',
          endName: s.endName || '',
          stationCount: s.stationCount || 0,
          sectionTime: s.sectionTime || 0,
          way: s.way || '',
          wayCode: s.wayCode,
        }
      }
    })

  // 도보 구간 정리
  const walkSteps = subPaths
    .filter(s => s.trafficType === 3)
    .reduce((acc, s) => acc + (s.distance || 0), 0)

  return {
    pathType: path.pathType,
    pathTypeLabel: PATH_TYPE[path.pathType] || '대중교통',
    totalTime: info.totalTime || 0,
    totalDistance: info.totalDistance || 0,
    totalWalk: walkSteps,
    totalFare: info.payment || info.cashPayment || 0,
    busTransitCount: info.busTransitCount || 0,
    subwayTransitCount: info.subwayTransitCount || 0,
    steps: transitSteps,
    // 첫 번째 탑승 정류장 (버스 실시간 조회에 사용)
    firstBusStep: transitSteps.find(s => s.type === 'bus') || null,
  }
}

// ─── 버스 실시간 도착 ─────────────────────────────────────────────────────────
/**
 * @param {number} stationId ODsay 정류장 ID
 * @param {number[]} busIds   ODsay 버스 노선 ID 배열
 */
export async function getRealtimeBusInfo(stationId, busIds = []) {
  if (!API_KEY || !stationId) return null

  try {
    const key = encodeURIComponent(API_KEY)
    const routeIDs = busIds.join(',')
    const url = `${BASE}/realtimeInfo?lang=0&apiKey=${key}&stationID=${stationId}&routeIDs=${routeIDs}`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const json = await res.json()

    const real = json?.result?.real
    if (!real?.length) return null

    return real.map(r => ({
      busNo: r.busNo || '',
      busId: r.busID,
      remainSeat: r.remainSeatCnt ?? -1,
      locationNo1: r.locationNo1 ?? 0, // 몇 정류장 전
      predictTime1: r.predictTime1 ?? null, // 도착 예정 분
      predictTime2: r.predictTime2 ?? null,
      isLowFloor: r.isLowPlate === 1,
      stationName: r.stationName || '',
    }))
  } catch (e) {
    console.warn('ODsay realtime error:', e)
    return null
  }
}

// ─── 지하철 노선 색상 매핑 ────────────────────────────────────────────────────
function subwayColor(code) {
  const map = {
    1: '#0052A4', 2: '#009246', 3: '#EF7C1C', 4: '#00A5DE',
    5: '#996CAC', 6: '#CD7C2F', 7: '#747F00', 8: '#E6186C', 9: '#BDB092',
    21: '#77C4A3',  // 경의중앙선
    22: '#0065B3',  // 공항철도
    100: '#F5A200', // 수인분당선
    101: '#D4003B', // 신분당선
  }
  return map[code] || '#64748B'
}

// ─── 도착 시간 문자열 포맷 ────────────────────────────────────────────────────
export function formatArrivalTime(predictMin, locationNo) {
  if (predictMin === null || predictMin === undefined) return '정보없음'
  if (predictMin <= 0) return '곧 도착'
  if (predictMin === 1) return '1분 후 도착'
  if (locationNo > 0) return `${predictMin}분 후 (${locationNo}정류장 전)`
  return `${predictMin}분 후 도착`
}

// ─── pathType 아이콘 ──────────────────────────────────────────────────────────
export function pathTypeIcon(type) {
  return type === 1 ? '🚇' : type === 2 ? '🚌' : '🚌🚇'
}
