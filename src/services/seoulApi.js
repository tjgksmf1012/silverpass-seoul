/**
 * 서울 열린데이터광장 + 공공데이터포털 API 연동
 *
 * 사용 데이터셋:
 *  - RealtimeCityAir          : 서울시 실시간 대기환경 정보 (대기질·미세먼지)
 *  - LiftStatusInfoService    : 서울교통공사 승강기 가동현황
 *  - SearchPublicToiletPOIService : 서울시 공중화장실 위치정보
 *  - TbGtnHireshelter         : 서울시 무더위쉼터
 *  - BusStopArInfoByRouteList  : 서울시 버스도착정보 (정류소 ID 필요 → mock 보완)
 */

const SEOUL_KEY = import.meta.env.VITE_SEOUL_API_KEY || 'DEMO'
const IS_DEMO = SEOUL_KEY === 'DEMO'
const GONGGONG_KEY = import.meta.env.VITE_GONGGONG_API_KEY || ''
const IS_GONGGONG_DEMO = !GONGGONG_KEY

// 서버사이드 프록시(Vercel function) vs 브라우저 직접 호출
// HTTP 환경(로컬 Vite dev)에서는 직접 호출 가능
// HTTPS 환경(Vercel 배포)에서는 mixed-content 차단 → 프록시 경유
const USE_PROXY =
  typeof window !== 'undefined' && window.location.protocol === 'https:'

const DIRECT_BASE = `http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json`

/**
 * 서울 OpenAPI 호출 (DEMO 키이면 null 반환 → mock 사용)
 */
async function seoulFetch(service, start = 1, end = 10, ...pathExtras) {
  if (IS_DEMO) return null

  try {
    let url
    if (USE_PROXY) {
      const params = new URLSearchParams({ service, start, end })
      pathExtras.forEach((v, i) => params.set(`p${i}`, v))
      url = `/api/seoul?${params}`
    } else {
      url = `${DIRECT_BASE}/${service}/${start}/${end}/`
      if (pathExtras.length) url += pathExtras.map(encodeURIComponent).join('/') + '/'
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const json = await res.json()
    if (json?._demo) return null
    return json
  } catch {
    return null
  }
}

// ─── 대기환경 (RealtimeCityAir) ──────────────────────────────────────────────
export async function getAirQuality(district = '종로구') {
  const data = await seoulFetch('RealtimeCityAir', 1, 5, ' ', district)
  const item = data?.RealtimeCityAir?.row?.[0]
  if (!item) return getMockAirQuality()

  const pm10 = parseInt(item.PM) || 0
  const pm25 = parseInt(item.FPM) || 0
  const grade = item.CAI_GRD || '보통'
  return {
    pm10,
    pm25,
    grade,           // 좋음 / 보통 / 나쁨 / 매우나쁨
    airAlert: grade === '나쁨' || grade === '매우나쁨',
    station: item.MSRSTN_NM || district,
    measuredAt: item.MSRMT_DT || '',
  }
}

// ─── 승강기 가동현황 (LiftStatusInfoService) ─────────────────────────────────
export async function getElevatorStatus(stationKeyword = '') {
  const data = await seoulFetch('LiftStatusInfoService', 1, 20)
  const rows = data?.LiftStatusInfoService?.row
  if (!rows?.length) return getMockElevatorStatus()

  const filtered = stationKeyword
    ? rows.filter(r => r.STATION_NM?.includes(stationKeyword))
    : rows

  const total = filtered.length || rows.length
  const operating = (filtered.length ? filtered : rows).filter(
    r => r.STUS_NM === '운행중' || r.STUS_NM === '정상'
  ).length

  return {
    total,
    operational: operating,
    allOk: operating === total,
    stationName: filtered[0]?.STATION_NM || '',
  }
}

// ─── 공중화장실 (SearchPublicToiletPOIService) ────────────────────────────────
export async function getNearbyToilets(district = '종로구') {
  const data = await seoulFetch('SearchPublicToiletPOIService', 1, 5, district)
  const rows = data?.SearchPublicToiletPOIService?.row
  if (!rows?.length) return getMockToilets()

  return rows.slice(0, 3).map(r => ({
    name: r.FNAME || r.TOILET_NM || '공중화장실',
    address: r.ANAME || r.RDNMADR || '',
    openHour: r.OPENHOUR || '24시간',
    hasDisabled: r.DISABLED_YN === 'Y',
  }))
}

// ─── 무더위쉼터 (TbGtnHireshelter) ───────────────────────────────────────────
export async function getHeatShelters(district = '종로구') {
  const data = await seoulFetch('TbGtnHireshelter', 1, 5, district)
  const rows = data?.TbGtnHireshelter?.row
  if (!rows?.length) return getMockHeatShelters()

  return rows.slice(0, 3).map(r => ({
    name: r.FCLTY_NM || r.SHELTER_NM || '무더위쉼터',
    address: r.RDNMADR || r.LNMADR || '',
    type: r.FCLTY_TYP || '공공시설',
  }))
}

// ─── 공공데이터포털 호출 헬퍼 ────────────────────────────────────────────────────
async function gonggongFetch(type, district = '종로구', numOfRows = 5) {
  if (IS_GONGGONG_DEMO) return null

  try {
    let url
    if (USE_PROXY) {
      const params = new URLSearchParams({ type, Q0: '서울특별시', Q1: district, numOfRows })
      url = `/api/gonggong?${params}`
    } else {
      // 개발환경: 직접 호출 (HTTP)
      const key = encodeURIComponent(GONGGONG_KEY)
      const base = 'http://apis.data.go.kr/B552657'
      if (type === 'pharmacy') {
        url = `${base}/ErmctInsttInfoInqireService/getParmacyListInfoInqire?serviceKey=${key}&Q0=${encodeURIComponent('서울특별시')}&Q1=${encodeURIComponent(district)}&numOfRows=${numOfRows}&pageNo=1&_type=json`
      } else {
        url = `${base}/ErmctInfoInqireService/getEgytListInfoInqire?serviceKey=${key}&Q0=${encodeURIComponent('서울특별시')}&Q1=${encodeURIComponent(district)}&numOfRows=${numOfRows}&pageNo=1&_type=json`
      }
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = await res.json()
    if (json?._demo) return null
    return json
  } catch {
    return null
  }
}

// ─── 근처 약국 (공공데이터포털 약국 현황) ──────────────────────────────────────
export async function getNearbyPharmacies(district = '종로구') {
  const data = await gonggongFetch('pharmacy', district, 5)
  const items = data?.response?.body?.items?.item
  if (!items) return getMockPharmacies()

  const list = Array.isArray(items) ? items : [items]
  return list.slice(0, 3).map(r => ({
    name: r.dutyName || '약국',
    address: r.dutyAddr || '',
    tel: r.dutyTel1 || '',
    hours: r.dutyTime1s ? `${r.dutyTime1s?.slice(0,2)}:${r.dutyTime1s?.slice(2,4)}~${r.dutyTime1c?.slice(0,2)}:${r.dutyTime1c?.slice(2,4)}` : '영업시간 확인 필요',
  }))
}

// ─── 응급의료기관 (공공데이터포털 응급의료기관 목록) ───────────────────────────
export async function getNearbyEmergencyHospitals(district = '종로구') {
  const data = await gonggongFetch('hospital', district, 5)
  const items = data?.response?.body?.items?.item
  if (!items) return getMockEmergencyHospitals()

  const list = Array.isArray(items) ? items : [items]
  return list.slice(0, 3).map(r => ({
    name: r.dutyName || '응급의료기관',
    address: r.dutyAddr || '',
    tel: r.dutyTel1 || '',
    level: r.dutyEmclsName || '응급의료기관',
  }))
}

// ─── 버스 도착정보 ─────────────────────────────────────────────────────────────
// 정류소 ID(arsId)가 없으면 실시간 호출 불가 → 현실적인 mock 사용
export async function getBusArrival(arsId = null) {
  if (!arsId || IS_DEMO) return getMockBusArrival()

  const data = await seoulFetch('BusStopArInfoByRouteList', 1, 10, arsId)
  const rows = data?.BusStopArInfoByRouteList?.row
  if (!rows?.length) return getMockBusArrival()

  return rows.map(r => ({
    busNo: r.busRouteAbrv || r.rtNm || '',
    arrmsg1: r.arrmsg1 || '정보없음',
    isLowFloor: r.isLowFloor === '1' || r.LOW_PLATE_AT === 'Y',
  }))
}

// ─── 통합 경로 데이터 ─────────────────────────────────────────────────────────
export async function getRouteData(destination, profile) {
  const district = profile.district || '종로구'

  const [air, bus, elevator, toilets, shelters, pharmacies] = await Promise.all([
    getAirQuality(district),
    getBusArrival(null),
    getElevatorStatus(),
    getNearbyToilets(district),
    getHeatShelters(district),
    getNearbyPharmacies(district),
  ])

  const walkDistance = profile.mobilityAid ? 180 : 250
  const duration = Math.ceil(walkDistance / 50) + 8

  const burden = calcBurden(air, elevator, profile)

  return {
    destination,
    // 날씨 / 대기
    weather: getWeatherLabel(air),
    weatherAlert: buildWeatherAlert(air),
    // 대기질
    airQuality: air,
    // 버스
    buses: bus,
    lowFloorBus: bus.some(b => b.isLowFloor),
    // 승강기
    elevator: elevator.allOk,
    elevatorMsg: elevator.allOk
      ? `승강기 ${elevator.operational}개 정상 운행`
      : `⚠️ 일부 승강기 점검 중 (${elevator.operational}/${elevator.total})`,
    // 도보
    walkDistance,
    duration,
    // 부담도
    burden,
    // 편의시설
    toilets,
    shelters: air.airAlert || air.pm10 > 80 ? shelters : [],
    pharmacies,
    // 데이터 출처 메타
    dataSources: buildDataSources(air, elevator),
  }
}

// ─── 부담도 계산 ──────────────────────────────────────────────────────────────
function calcBurden(air, elevator, profile) {
  let score = 0
  if (air.airAlert) score += 2
  if (air.pm10 > 80) score += 1
  if (!elevator.allOk && !profile.allowStairs) score += 3
  if (profile.mobilityAid) score += 1
  if (score === 0) return 'low'
  if (score <= 2) return 'medium'
  return 'high'
}

function getWeatherLabel(air) {
  const grade = air.grade
  const pm = air.pm10
  if (grade === '매우나쁨') return `대기 매우나쁨 ⚠️`
  if (grade === '나쁨') return `대기 나쁨 🌫️`
  if (pm > 50) return `미세먼지 보통 😐`
  return `대기 좋음 ✅`
}

function buildWeatherAlert(air) {
  if (air.grade === '매우나쁨') return '🌫️ 미세먼지 매우나쁨 — 외출 자제 권고'
  if (air.grade === '나쁨') return '🌫️ 미세먼지 나쁨 — 마스크를 착용하세요'
  if (air.pm10 > 80) return '🔆 폭염 주의 — 무더위쉼터를 이용하세요'
  return null
}

function buildDataSources(air, elevator) {
  return [
    { label: '실시간 대기환경', api: 'RealtimeCityAir', live: !IS_DEMO },
    { label: '승강기 가동현황', api: 'LiftStatusInfoService', live: !IS_DEMO },
    { label: '버스 도착정보', api: 'BusStopArInfoByRouteList', live: false },
    { label: '공중화장실 위치', api: 'SearchPublicToiletPOIService', live: !IS_DEMO },
    { label: '근처 약국', api: '공공데이터포털 약국현황', live: !IS_GONGGONG_DEMO },
  ]
}

// ─── Mock 데이터 (API 키 없거나 실패 시 사용) ─────────────────────────────────
function getMockAirQuality() {
  return {
    pm10: 32,
    pm25: 18,
    grade: '좋음',
    airAlert: false,
    station: '종로구 (샘플)',
    measuredAt: new Date().toLocaleString('ko-KR'),
  }
}

function getMockElevatorStatus() {
  return { total: 4, operational: 4, allOk: true, stationName: '' }
}

function getMockToilets() {
  return [
    { name: '탑골공원 공중화장실', address: '종로구 종로 99', openHour: '06:00~22:00', hasDisabled: true },
    { name: '종로구청 1층 화장실', address: '종로구 종로1길 36', openHour: '09:00~18:00', hasDisabled: true },
    { name: '광화문광장 화장실', address: '종로구 세종대로 172', openHour: '24시간', hasDisabled: true },
  ]
}

function getMockHeatShelters() {
  return [
    { name: '종로구청 민원실', address: '종로구 종로1길 36', type: '공공기관' },
    { name: '탑골공원 쉼터', address: '종로구 종로 99', type: '공원' },
  ]
}

function getMockBusArrival() {
  return [
    { busNo: '370', arrmsg1: '3분 후 도착', isLowFloor: true },
    { busNo: '7212', arrmsg1: '8분 후 도착', isLowFloor: false },
    { busNo: '100', arrmsg1: '12분 후 도착', isLowFloor: true },
  ]
}

function getMockPharmacies() {
  return [
    { name: '종로한미약국', address: '종로구 종로 55', tel: '02-732-1234', hours: '09:00~21:00' },
    { name: '광화문약국', address: '종로구 세종대로 163', tel: '02-720-5678', hours: '09:00~20:00' },
    { name: '탑골약국', address: '종로구 종로 99', tel: '02-743-9012', hours: '09:30~19:30' },
  ]
}

function getMockEmergencyHospitals() {
  return [
    { name: '서울대학교병원', address: '종로구 대학로 101', tel: '02-2072-2114', level: '권역응급의료센터' },
    { name: '서울적십자병원', address: '종로구 새문안로 9', tel: '02-2002-8000', level: '지역응급의료센터' },
  ]
}
