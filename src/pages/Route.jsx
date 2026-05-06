import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getProfile, addHistory } from '../services/storage.js'
import { getRouteData, getRealtimeSubwayArrival } from '../services/seoulApi.js'
import { generateSubwayGuide } from '../services/claude.js'
import { searchPlaces, findKnownSeoulPlace } from '../services/kakaoSearch.js'
import { searchTransitRoute, getRealtimeBusInfo, formatArrivalTime, getTransitRouteIssue, pathTypeIcon } from '../services/odsayApi.js'
import { getCurrentUser, getElderInfo, saveHistory, getLinkedGuardian } from '../services/auth.js'
import { ArrowLeft, BusIcon, ElevatorIcon, WindIcon,
         ShelterIcon, AlertIcon, SearchIcon, MapPin } from '../components/Icons.jsx'
import RouteMap from '../components/RouteMap.jsx'

const BURDEN = {
  low:    { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', accent: '#059669', label: '이동 쉬움', sub: '편하게 다녀오실 수 있어요' },
  medium: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', accent: '#D97706', label: '보통',     sub: '천천히 이동하시면 괜찮아요' },
  high:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', accent: '#DC2626', label: '힘들 수 있어요', sub: '보호자와 함께 이동하세요' },
}
const QUICK_ROUTE_POINTS = [
  { name: '서울역', address: '서울 중구 한강대로 405', lat: 37.5546788, lng: 126.9706069 },
  { name: '서울시청', address: '서울 중구 세종대로 110', lat: 37.5662952, lng: 126.9779451 },
  { name: '강남역', address: '서울 강남구 강남대로 396', lat: 37.497952, lng: 127.027619 },
]
const WALK_ONLY_DISTANCE_M = 900
const WALK_ONLY_FALLBACK_DISTANCE_M = 1400
const WALK_ONLY_DETOUR_RATIO = 1.75

function normalizeRoutePoint(place) {
  const lat = Number(place?.lat)
  const lng = Number(place?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    name: place.name || place.label || place.address || '선택한 장소',
    address: place.address || place.name || place.label || '',
    lat,
    lng,
  }
}

function coordKey(coords) {
  const via = coords?.via ? `${coords.via.lat},${coords.via.lng}` : 'none'
  return `${coords?.user?.lat},${coords?.user?.lng}:${via}:${coords?.dest?.lat},${coords?.dest?.lng}`
}

function compactRoutePoints(points) {
  return points.filter(point =>
    Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
  ).reduce((acc, point) => {
    const normalized = { lat: Number(point.lat), lng: Number(point.lng) }
    const prev = acc[acc.length - 1]
    if (!prev || Math.abs(prev.lat - normalized.lat) > 0.00001 || Math.abs(prev.lng - normalized.lng) > 0.00001) {
      acc.push(normalized)
    }
    return acc
  }, [])
}

function combineViaRoutes(firstLeg, secondLeg, via) {
  const viaStep = {
    type: 'walk',
    title: `${via?.name || '경유지'} 들르기`,
    detail: via?.address || '경유지를 지나 다음 이동으로 이어가요.',
    meta: '경유',
  }
  const steps = [...(firstLeg.steps || []), viaStep, ...(secondLeg.steps || [])]
  return {
    ...secondLeg,
    pathType: 3,
    pathTypeLabel: '경유 경로',
    totalTime: (firstLeg.totalTime || 0) + (secondLeg.totalTime || 0),
    totalDistance: (firstLeg.totalDistance || 0) + (secondLeg.totalDistance || 0),
    totalWalk: (firstLeg.totalWalk || 0) + (secondLeg.totalWalk || 0),
    totalFare: Math.max(firstLeg.totalFare || 0, secondLeg.totalFare || 0),
    busTransitCount: (firstLeg.busTransitCount || 0) + (secondLeg.busTransitCount || 0),
    subwayTransitCount: (firstLeg.subwayTransitCount || 0) + (secondLeg.subwayTransitCount || 0),
    steps,
    routePoints: compactRoutePoints([
      ...(firstLeg.routePoints || []),
      ...(via?.lat && via?.lng ? [{ lat: via.lat, lng: via.lng }] : []),
      ...(secondLeg.routePoints || []),
    ]),
    firstBusStep: steps.find(s => s.type === 'bus') || null,
  }
}

function routeDistanceLabel(meters) {
  if (meters == null) return '-'
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
}

function hasCoords(place) {
  return Number.isFinite(Number(place?.lat)) && Number.isFinite(Number(place?.lng))
}

function routeTransferCount(route) {
  return (route?.busTransitCount || 0) + (route?.subwayTransitCount || 0)
}

function routePreferenceLabels(profile = {}) {
  return [
    !profile.allowStairs && '계단 없음',
    profile.mobilityAid && '보조기구',
    profile.preferLowFloorBus && '저상버스',
    profile.preferElevator && '승강기',
    profile.avoidTransfers && '환승 적게',
    profile.needRestStops && '쉴 곳',
    profile.slowPace && '천천히',
  ].filter(Boolean)
}

function scoreRouteForProfile(route, profile = {}) {
  if (!route) return Infinity
  const walk = route.totalWalk || 0
  const transfers = routeTransferCount(route)
  const busSteps = route.steps?.filter(step => step.type === 'bus').length || 0
  const subwaySteps = route.steps?.filter(step => step.type === 'subway').length || 0
  let score = (route.totalTime || 999) + walk / 90 + transfers * 4

  if (profile.avoidTransfers) score += transfers * 8
  if (!profile.allowStairs || profile.preferElevator || profile.mobilityAid) {
    score += subwaySteps * 3 + walk / 120
  }
  if (profile.mobilityAid || profile.slowPace) score += walk / 80
  if (profile.needRestStops) score += walk / 140 + transfers * 2
  if (profile.preferLowFloorBus) score += busSteps ? (route.pathType === 2 ? -3 : 0) : 6

  return score
}

function applyRoutePreferences(routes, profile = {}) {
  return [...routes]
    .map((route, originalIndex) => ({
      ...route,
      preferenceScore: scoreRouteForProfile(route, profile),
      originalIndex,
    }))
    .sort((a, b) => a.preferenceScore - b.preferenceScore || a.originalIndex - b.originalIndex)
}

function getRouteCriteria(route, index, routes = [], profile = {}) {
  const candidates = routes.filter(Boolean)
  if (!route || !candidates.length) {
    return { label: '추천 경로', short: '추천', desc: '시간과 이동 부담을 함께 본 경로', color: '#0D9488' }
  }

  const minTime = Math.min(...candidates.map(r => r.totalTime || Infinity))
  const minWalk = Math.min(...candidates.map(r => r.totalWalk ?? Infinity))
  const minFare = Math.min(...candidates.map(r => r.totalFare || Infinity))
  const transferCount = routeTransferCount(route)
  const minTransfers = Math.min(...candidates.map(routeTransferCount))

  if (index === 0) {
    const labels = routePreferenceLabels(profile)
    return {
      label: '맞춤 추천 경로',
      short: '맞춤 추천',
      desc: labels.length
        ? `설정한 이동 조건(${labels.slice(0, 3).join(', ')})을 먼저 반영한 경로`
        : '시간·도보·환승을 종합한 기본 추천',
      color: '#0D9488',
    }
  }
  if (route.totalTime === minTime) return { label: '최단 시간', short: '빠름', desc: '도착 시간이 가장 짧은 경로', color: '#2563EB' }
  if ((route.totalWalk ?? Infinity) === minWalk) return { label: '최소 도보', short: '적게 걷기', desc: '걷는 거리가 가장 짧은 경로', color: '#059669' }
  if (transferCount === minTransfers) return { label: '환승 적음', short: '간단', desc: '갈아타는 부담이 낮은 경로', color: '#D97706' }
  if ((route.totalFare || Infinity) === minFare) return { label: '최소 요금', short: '저렴', desc: '요금 부담이 가장 낮은 경로', color: '#7C3AED' }
  return { label: route.pathTypeLabel || '대안 경로', short: '대안', desc: '다른 이동 방식을 선택할 수 있는 경로', color: '#64748B' }
}

function lineText(lines = []) {
  return lines.map(line => line.busNo || line.name).filter(Boolean).join(', ')
}

function busLineText(lines = []) {
  return lines.map(line => line.busNo ? `${line.busNo}번` : line.name).filter(Boolean).join(', ')
}

function summarizeStops(stops = [], limit = 4) {
  const clean = stops.filter(Boolean)
  if (clean.length <= 2) return ''
  const middle = clean.slice(1, -1)
  const shown = middle.slice(0, limit)
  if (!shown.length) return ''
  return `${shown.join(' → ')}${middle.length > limit ? ' → ...' : ''}`
}

export default function Route_() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [routeData, setRouteData]         = useState(null)
  const [autoShared, setAutoShared]       = useState(false)
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState('bus')
  const [subwayGuide, setSubwayGuide]     = useState(null)
  const [realtimeArrivals, setRealtimeArrivals] = useState(null)
  const [transitRoutes, setTransitRoutes] = useState(null)  // ODsay 경로
  const [realtimeBus, setRealtimeBus]     = useState(null)  // ODsay 버스 실시간
  const [transitIssue, setTransitIssue]   = useState('')
  const [liveCoords, setLiveCoords]       = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(0)     // 선택된 경로 인덱스
  const [currentGuideStep, setCurrentGuideStep] = useState(0)
  const [healthNotes, setHealthNotes]     = useState('')
  const [manualStart, setManualStart]     = useState(() => normalizeRoutePoint(state?.startPlace || state?.parsed?.startPlace))
  const [viaPlace, setViaPlace]           = useState(() => normalizeRoutePoint(state?.viaPlace || state?.parsed?.viaPlace))
  const [pointEditor, setPointEditor]     = useState(null)  // start | via
  const [pointQuery, setPointQuery]       = useState('')
  const [pointSuggestions, setPointSuggestions] = useState([])
  const [pointSearching, setPointSearching] = useState(false)
  const [resolvedDestinationPlace, setResolvedDestinationPlace] = useState(null)
  const [destinationResolving, setDestinationResolving] = useState(false)
  const [destinationResolveNote, setDestinationResolveNote] = useState('')
  const coordsApplied = useRef(false)

  const profile = getProfile()
  const routeRequestText = state?.parsed?.destination || state?.parsed?.address || state?.query || ''
  const hasRouteRequest = Boolean(routeRequestText || state?.parsed?.lat || state?.parsed?.lng)
  const baseDestination = routeRequestText
  const knownDestinationPlace = useMemo(
    () => findKnownSeoulPlace(state?.parsed?.address || baseDestination),
    [state?.parsed?.address, baseDestination]
  )
  const destinationCategory = state?.parsed?.category || knownDestinationPlace?.category || ''
  const hasFixedDestination = Boolean(state?.parsed?.address || (state?.parsed?.lat && state?.parsed?.lng) || knownDestinationPlace)
  const destination = resolvedDestinationPlace?.name || knownDestinationPlace?.name || baseDestination
  const destinationSearchKeyword = resolvedDestinationPlace?.address || knownDestinationPlace?.address || state?.parsed?.address || destination
  const placeCoords = useMemo(() => {
    if (hasCoords(resolvedDestinationPlace)) {
      return { lat: resolvedDestinationPlace.lat, lng: resolvedDestinationPlace.lng }
    }
    if (hasCoords(knownDestinationPlace)) {
      return { lat: knownDestinationPlace.lat, lng: knownDestinationPlace.lng }
    }
    return (state?.parsed?.lat && state?.parsed?.lng)
      ? { lat: state.parsed.lat, lng: state.parsed.lng }
      : null
  }, [resolvedDestinationPlace, knownDestinationPlace, state?.parsed?.lat, state?.parsed?.lng])

  function resetTransitRoute() {
    coordsApplied.current = false
    setTransitRoutes(null)
    setRealtimeBus(null)
    setTransitIssue('')
    setSelectedRoute(0)
    setLiveCoords(null)
    setRouteData(prev => prev ? { ...prev, coordsBased: false, coordSource: null, startLabel: null, viaLabel: null } : prev)
  }

  function openPointEditor(type) {
    setPointEditor(type)
    setPointQuery(type === 'start' ? (manualStart?.name || '') : (viaPlace?.name || ''))
    setPointSuggestions([])
  }

  function applyRoutePoint(place, type = pointEditor) {
    const point = normalizeRoutePoint(place)
    if (!point) return
    if (type === 'via') setViaPlace(point)
    else setManualStart(point)
    setPointEditor(null)
    setPointQuery('')
    setPointSuggestions([])
    resetTransitRoute()
  }

  function clearRoutePoint(type) {
    if (type === 'via') setViaPlace(null)
    else setManualStart(null)
    setPointEditor(null)
    setPointQuery('')
    setPointSuggestions([])
    resetTransitRoute()
  }

  async function searchRoutePoint() {
    const text = pointQuery.trim()
    if (!text) return
    setPointSearching(true)
    setPointSuggestions([{ name: '검색 중...', address: '', isLoading: true }])
    try {
      const results = await searchPlaces(text)
      setPointSuggestions(results.length ? results : [{ name: '검색 결과 없음', address: text, isEmpty: true }])
    } catch {
      setPointSuggestions([{ name: '검색 결과 없음', address: text, isEmpty: true }])
    } finally {
      setPointSearching(false)
    }
  }

  useEffect(() => {
    const shouldResolveNearStart =
      destinationCategory &&
      !hasFixedDestination &&
      hasCoords(manualStart)

    if (!shouldResolveNearStart) {
      setResolvedDestinationPlace(null)
      setDestinationResolving(false)
      setDestinationResolveNote('')
      return
    }

    let cancelled = false
    async function resolveDestinationNearStart() {
      setDestinationResolving(true)
      setResolvedDestinationPlace(null)
      setDestinationResolveNote(`${manualStart.name} 근처 ${destinationCategory}을 다시 찾는 중이에요`)
      resetTransitRoute()
      try {
        const results = await searchPlaces(destinationCategory, {
          location: { lat: manualStart.lat, lng: manualStart.lng },
          radius: 7000,
        })
        if (cancelled) return
        const place = results[0]
        if (place) {
          setResolvedDestinationPlace({ ...place, category: destinationCategory, anchorName: manualStart.name })
          setDestinationResolveNote(`${manualStart.name} 근처 ${destinationCategory}으로 목적지를 다시 맞췄어요`)
        } else {
          setDestinationResolveNote(`${manualStart.name} 근처 ${destinationCategory}을 찾지 못해 기존 검색어를 유지했어요`)
        }
        resetTransitRoute()
      } catch {
        if (!cancelled) {
          setDestinationResolveNote(`${manualStart.name} 근처 장소를 다시 찾지 못해 기존 검색어를 유지했어요`)
        }
      } finally {
        if (!cancelled) setDestinationResolving(false)
      }
    }

    resolveDestinationNearStart()
    return () => { cancelled = true }
  }, [destinationCategory, hasFixedDestination, manualStart?.lat, manualStart?.lng, manualStart?.name])

  // ── 초기 로드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!hasRouteRequest) {
        setLoading(false)
        return
      }
      try {
        const user = getCurrentUser()
        const elderInfo = user ? await getElderInfo(user.id) : null
        const notes = elderInfo?.notes || profile.healthNotes || ''
        setHealthNotes(notes)
        const profileWithNotes = { ...profile, healthNotes: notes }

        const [data, subway] = await Promise.all([
          getRouteData(destination, profileWithNotes, null),
          generateSubwayGuide(destination),
        ])
        setRouteData(data)
        setSubwayGuide(subway)
        addHistory({ destination, duration: data.duration, burden: data.burden })
        const canAutoShare = user?.id && !String(user.id).startsWith('guest_')
        if (canAutoShare) {
          const [guardian] = await Promise.all([
            getLinkedGuardian(user.id),
            saveHistory(user.id, { destination, burden: data.burden, duration: String(data.duration) }),
          ])
          setAutoShared(Boolean(guardian))
        }
        if (subway?.nearestStation) {
          const arrivals = await getRealtimeSubwayArrival(subway.nearestStation)
          setRealtimeArrivals(arrivals)
        }
      } finally { setLoading(false) }
    }
    load()
  }, [])

  // ── 카카오맵 좌표 콜백 → ODsay 실제 경로 탐색 ────────────────────────────
  const handleCoordsReady = useCallback(async (coords) => {
    const key = coordKey(coords)
    if (coordsApplied.current === key) return
    coordsApplied.current = key
    setLiveCoords(coords)
    setSelectedRoute(0)
    setTransitRoutes(null)
    setRealtimeBus(null)
    setTransitIssue('')

    // 거리/시간 즉시 업데이트
    setRouteData(prev => prev ? {
      ...prev,
      walkDistance: coords.dist,
      duration: coords.duration,
      coordsBased: true,
      coordSource: coords.source || 'gps',
      startLabel: coords.startLabel || '',
      viaLabel: coords.via?.name || '',
    } : prev)

    // ODsay 경로 탐색 (출발: user, 도착: dest. 경도/위도 순서 주의)
    let routes = null
    if (coords.via?.lat && coords.via?.lng) {
      const [firstLeg, secondLeg] = await Promise.all([
        searchTransitRoute(coords.user.lng, coords.user.lat, coords.via.lng, coords.via.lat),
        searchTransitRoute(coords.via.lng, coords.via.lat, coords.dest.lng, coords.dest.lat),
      ])
      if (firstLeg?.length && secondLeg?.length) {
        routes = [combineViaRoutes(firstLeg[0], secondLeg[0], coords.via)]
      }
    } else {
      routes = await searchTransitRoute(
        coords.user.lng, coords.user.lat,  // SX=경도, SY=위도
        coords.dest.lng, coords.dest.lat
      )
    }
    if (routes?.length) {
      const rankedRoutes = applyRoutePreferences(routes, profile)
      setTransitRoutes(rankedRoutes)
      setTransitIssue('')
      // 첫 경로의 첫 버스 정류장 실시간 도착 조회
      const firstBus = rankedRoutes[0]?.firstBusStep
      if (firstBus?.startStationId) {
        const busIds = firstBus.lines.map(l => l.busId).filter(Boolean)
        const real = await getRealtimeBusInfo(firstBus.startStationId, busIds)
        setRealtimeBus(real)
      }
    } else {
      setTransitRoutes(null)
      setTransitIssue(getTransitRouteIssue())
    }
  }, [])

  useEffect(() => {
    async function loadSelectedBusRealtime() {
      const firstBus = transitRoutes?.[selectedRoute]?.firstBusStep
      if (!firstBus?.startStationId) {
        setRealtimeBus(null)
        return
      }
      const busIds = firstBus.lines.map(l => l.busId).filter(Boolean)
      const real = await getRealtimeBusInfo(firstBus.startStationId, busIds)
      setRealtimeBus(real)
    }
    loadSelectedBusRealtime()
  }, [transitRoutes, selectedRoute])

  useEffect(() => {
    setCurrentGuideStep(0)
  }, [selectedRoute, destination, manualStart?.lat, manualStart?.lng, viaPlace?.lat, viaPlace?.lng])

  if (!hasRouteRequest) return (
    <div style={{ minHeight: '100vh', background: '#F3F7FA', padding: '54px 20px 32px', display: 'flex', flexDirection: 'column' }}>
      <button onClick={() => navigate('/')} aria-label="홈으로 돌아가기" style={{ width: 48, height: 48, borderRadius: 14, border: '1.5px solid #CBD5E1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginBottom: 28 }}>
        <ArrowLeft size={22} color="#0F172A" />
      </button>
      <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 24, padding: '28px 22px', textAlign: 'center', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <SearchIcon size={32} color="#0D9488" stroke={2.2} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 950, color: '#0F172A', margin: '0 0 8px' }}>목적지를 먼저 선택해 주세요</h1>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#64748B', lineHeight: 1.6, margin: '0 0 20px' }}>
          홈 화면에서 목적지를 검색하거나 가까운 곳을 누르면 정확한 전체 경로를 보여드려요.
        </p>
        <button onClick={() => navigate('/')} style={{ width: '100%', border: 'none', borderRadius: 16, background: 'linear-gradient(135deg, #0F766E, #0D9488)', color: '#fff', fontSize: 18, fontWeight: 900, minHeight: 58, cursor: 'pointer', fontFamily: 'inherit' }}>
          홈에서 목적지 찾기
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: '#F8F9FA', padding: '0 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#0D9488', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>{destination}</p>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#0D9488', margin: 0 }}>최적 경로를 분석하는 중이에요</p>
      </div>
      <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: '대중교통 경로 탐색', color: '#059669' },
          { label: '정류장·환승 순서 확인', color: '#2563EB' },
          { label: '도보 구간 정리', color: '#7C3AED' },
        ].map((item, i) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', animation: `fadeIn 0.4s ease ${i * 0.15}s both` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{item.label}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  )

  const b = BURDEN[routeData?.burden] || BURDEN.low
  const air = routeData?.airQuality
  const isLive = routeData?.coordsBased
  const bestRoute = transitRoutes?.[selectedRoute]
  const selectedCriteria = getRouteCriteria(bestRoute, selectedRoute, transitRoutes || [], profile)
  const hasExactRoute = Boolean(bestRoute?.steps?.length)
  const primaryTime = bestRoute?.totalTime || routeData?.duration
  const primaryWalk = bestRoute?.totalWalk ?? routeData?.walkDistance
  const memo = healthNotes.trim()
  const memoShort = memo.length > 48 ? `${memo.slice(0, 48)}...` : memo
  const firstBusStepIndex = bestRoute?.steps?.findIndex(s => s.type === 'bus') ?? -1
  const isManualRoute = manualStart || routeData?.coordSource === 'manual'
  const startDisplay = manualStart?.name || routeData?.startLabel || '현재 위치'
  const directDistance = routeData?.walkDistance
  const transitDistance = Number(bestRoute?.totalDistance) || 0
  const transitDetourRatio = directDistance && transitDistance
    ? transitDistance / directDistance
    : 0
  const transitDetoursTooMuch = hasExactRoute &&
    directDistance <= WALK_ONLY_FALLBACK_DISTANCE_M &&
    transitDetourRatio >= WALK_ONLY_DETOUR_RATIO
  const hasWalkCoords = hasCoords(liveCoords?.user) && hasCoords(liveCoords?.dest)
  const isWalkOnlyRoute = Boolean(
    hasWalkCoords &&
    !viaPlace &&
    directDistance &&
    (
      directDistance <= WALK_ONLY_DISTANCE_M ||
      (!hasExactRoute && directDistance <= WALK_ONLY_FALLBACK_DISTANCE_M) ||
      transitDetoursTooMuch
    )
  )
  const walkOnlyMinutes = directDistance ? Math.max(5, Math.ceil(directDistance / 45) + 3) : routeData?.duration
  const displayPrimaryTime = isWalkOnlyRoute ? walkOnlyMinutes : primaryTime
  const displayPrimaryWalk = isWalkOnlyRoute ? directDistance : primaryWalk
  const routeBadge = isWalkOnlyRoute
    ? '도보 전용'
    : hasExactRoute
      ? (isManualRoute ? '공공데이터 반영' : 'ODsay 실시간')
      : (transitIssue ? 'API 확인 필요' : (manualStart ? '좌표 기준 안내' : '위치 허용 필요'))
  const noExactTitle = manualStart
    ? '선택한 출발지 기준으로 안내 중이에요'
    : '정확한 정류장·환승 순서는 위치 허용 후 표시돼요'
  const noExactBody = manualStart
    ? (transitIssue
      ? `대중교통 경로 API 응답을 확인해야 해요. 현재는 출발지와 목적지 좌표 기준으로 기본 이동 순서만 보여드려요. (${transitIssue})`
      : '정확한 대중교통 경로가 확인되면 정류장·환승 순서로 자동 보강돼요. 지금은 거리와 기본 이동 순서를 먼저 보여드려요.')
    : '현재는 기본 안내입니다. 위치를 허용하면 몇 분 걷고, 몇 번 버스나 어떤 지하철을 타는지 전체 순서로 바뀝니다.'

  const formatDistance = (meters) => {
    if (meters == null) return '-'
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
  }

  const formatStepTime = (step) => {
    if (!step?.sectionTime) return ''
    return `${step.sectionTime}분`
  }

  const getWalkText = (step, index, steps) => {
    if (step.title) return { title: step.title, detail: step.detail, meta: step.meta }
    const prev = steps[index - 1]
    const next = steps[index + 1]
    const nextPlace = next?.startStationName || next?.startName
    const prevPlace = prev?.endName || prev?.startName
    const meta = [formatStepTime(step), formatDistance(step.distance)].filter(Boolean).join(' · ')

    if (index === 0) {
      return {
        title: `${nextPlace || '첫 승차 지점'}까지 걷기`,
        detail: '현재 위치에서 출발해요.',
        meta,
      }
    }
    if (index === steps.length - 1) {
      return {
        title: `${destination}까지 걷기`,
        detail: prevPlace ? `${prevPlace}에서 내려 목적지까지 이동해요.` : '목적지까지 천천히 이동해요.',
        meta,
      }
    }
    return {
      title: `${nextPlace || '다음 승차 지점'}까지 걷기`,
      detail: prevPlace ? `${prevPlace}에서 내려 환승 지점까지 이동해요.` : '환승을 위해 이동해요.',
      meta,
    }
  }

  const fallbackRouteSteps = (() => {
    if (isWalkOnlyRoute) {
      return [{
        type: 'walk',
        title: `${destination}까지 걷기`,
        detail: `${startDisplay}에서 목적지까지 도보 중심으로 안내해요. 대기질, 쉼터, 응급 정보는 계속 공공데이터로 확인해요.`,
        meta: `${formatDistance(directDistance)} · 약 ${walkOnlyMinutes}분`,
        startPoint: liveCoords?.user,
        endPoint: liveCoords?.dest,
        routePoints: compactRoutePoints([liveCoords?.user, liveCoords?.dest]),
      }]
    }

    const firstBus = routeData?.buses?.find(bus => bus.isLowFloor) || routeData?.buses?.[0]
    const steps = [{
      type: 'walk',
      title: `${startDisplay}에서 가까운 정류장까지 걷기`,
      detail: manualStart ? `${manualStart.address || startDisplay} 기준으로 안내해요.` : '위치 권한을 허용하면 정확한 정류장과 도보 거리가 표시돼요.',
      meta: routeData?.walkDistance ? `약 ${formatDistance(routeData.walkDistance)}` : (manualStart ? '주소 기준' : '위치 필요'),
    }]

    if (transitIssue) {
      steps.push({
        type: 'walk',
        title: '대중교통 경로 확인 필요',
        detail: 'API 키나 권한이 정상화되면 버스 번호, 승차 정류장, 환승 순서가 이 자리에 표시돼요.',
        meta: '확인 필요',
      })
    } else if (firstBus) {
      steps.push({
        type: 'bus',
        lines: [{ busNo: firstBus.busNo, typeLabel: firstBus.isLowFloor ? '저상버스' : '버스' }],
        startName: '가까운 정류장',
        endName: `${destination} 근처`,
        sectionTime: routeData?.duration || 0,
        stationCount: 0,
        fallbackArrival: firstBus.arrmsg1,
      })
    } else if (subwayGuide) {
      steps.push({
        type: 'subway',
        lines: [{ name: subwayGuide.line, color: subwayGuide.lineColor }],
        startName: subwayGuide.nearestStation,
        endName: `${destination} 근처`,
        sectionTime: 0,
        stationCount: 0,
        way: subwayGuide.direction,
        fallbackExit: subwayGuide.exitNumber,
      })
    }

    if (viaPlace) {
      steps.push({
        type: 'walk',
        title: `${viaPlace.name} 경유지 확인`,
        detail: '정확 경로가 확인되면 경유 순서에 맞춰 다시 표시돼요.',
        meta: '경유',
      })
    }

    steps.push({
      type: 'walk',
      title: '하차 후 목적지까지 걷기',
      detail: `${destination} 입구까지 천천히 이동하세요.`,
      meta: subwayGuide?.walkFromExit || '도착 전 확인',
    })

    return steps
  })()
  const fullRouteSteps = isWalkOnlyRoute ? fallbackRouteSteps : (hasExactRoute ? bestRoute.steps : fallbackRouteSteps)
  const guideSteps = fullRouteSteps.map((step, index) => {
    if (step.type === 'walk') {
      const walkText = getWalkText(step, index, fullRouteSteps)
      return {
        icon: '🚶',
        title: walkText.title,
        body: walkText.detail,
        meta: walkText.meta,
        detail: '지도 점선과 목적지 표식을 보면서 천천히 이동하세요.',
        speak: `${index + 1}단계. ${walkText.title}. ${walkText.meta || ''}. ${walkText.detail}`,
      }
    }
    if (step.type === 'bus') {
      const buses = busLineText(step.lines)
      const meta = [step.sectionTime ? `${step.sectionTime}분` : '', step.stationCount ? `${step.stationCount}정류장` : ''].filter(Boolean).join(', ')
      const stopText = summarizeStops(step.passStops)
      return {
        icon: '🚌',
        title: `${buses || '버스'} 타기`,
        body: `${step.startStationName || step.startName || '승차 정류장'} 정류장에서 타고 ${step.endName || '도착 정류장'} 정류장에서 내리세요.${stopText ? ` 중간에 ${stopText}를 지나요.` : ''}`,
        meta,
        speak: `${index + 1}단계. ${buses || '버스'}를 탑니다. ${step.startStationName || step.startName || '승차 정류장'} 정류장에서 타고 ${step.endName || '도착 정류장'} 정류장에서 내리세요. ${meta}`,
      }
    }
    const rails = lineText(step.lines)
    const meta = [step.sectionTime ? `${step.sectionTime}분` : '', step.stationCount ? `${step.stationCount}개 역` : ''].filter(Boolean).join(', ')
    const stopText = summarizeStops(step.passStops)
    return {
      icon: '🚇',
      title: `${rails || '지하철'} 타기`,
      body: `${step.startName || '출발역'}에서 ${step.way ? `${step.way} 방면으로 ` : ''}타고 ${step.endName || '도착역'}에서 내리세요.${stopText ? ` 중간에 ${stopText}를 지나요.` : ''}`,
      meta,
      speak: `${index + 1}단계. ${rails || '지하철'}을 탑니다. ${step.startName || '출발역'}에서 ${step.way ? `${step.way} 방면으로 ` : ''}타고 ${step.endName || '도착역'}에서 내리세요. ${meta}`,
    }
  })
  const activeGuideIndex = Math.min(currentGuideStep, Math.max(guideSteps.length - 1, 0))
  const activeGuide = guideSteps[activeGuideIndex]
  const mapRouteGuide = isWalkOnlyRoute || !hasExactRoute
    ? { steps: fullRouteSteps, totalDistance: displayPrimaryWalk, totalTime: displayPrimaryTime }
    : bestRoute

  function speakGuideStep(guide) {
    if (!guide || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(guide.speak)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.86
    utterance.pitch = 0.95
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F7FA', paddingBottom: 128 }}>

      {/* ── 헤더 ── */}
      <div style={{ background: '#fff', padding: '52px 16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={() => navigate(-1)} aria-label="뒤로 가기" style={{ width: 48, height: 48, borderRadius: 14, border: '1.5px solid #CBD5E1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={22} color="#0F172A" />
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, color: '#64748B', fontWeight: 800, margin: 0 }}>목적지</p>
          <h1 style={{ fontSize: 23, fontWeight: 900, color: '#0F172A', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destination}</h1>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0, fontWeight: 800 }}>예상 시간</p>
          <p style={{ fontSize: 30, fontWeight: 900, color: '#0D9488', margin: '-1px 0 0', lineHeight: 1 }}>
            {displayPrimaryTime}
            <span style={{ fontSize: 16, fontWeight: 800 }}>분</span>
          </p>
          {isWalkOnlyRoute
            ? <span style={{ fontSize: 12, background: '#EFF6FF', color: '#2563EB', fontWeight: 900, padding: '3px 8px', borderRadius: 20 }}>🚶 도보 전용</span>
            : bestRoute
            ? <span style={{ fontSize: 12, background: '#F0FDFA', color: '#059669', fontWeight: 900, padding: '3px 8px', borderRadius: 20 }}>{isManualRoute ? '📍 직접 지정' : '🚌 실시간'}</span>
            : isLive
              ? <span style={{ fontSize: 12, background: '#ECFDF5', color: '#059669', fontWeight: 900, padding: '3px 8px', borderRadius: 20 }}>{isManualRoute ? '📍 출발지 지정' : '📍 GPS'}</span>
              : <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0', fontWeight: 700 }}>대중교통 추정</p>
          }
        </div>
      </div>

      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── 출발지/경유지 지정 ── */}
        <div style={{ order: 0, background: '#fff', border: '1.5px solid #D9F7EF', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MapPin size={17} color="#0D9488" stroke={2} />
            <p style={{ fontSize: 15, fontWeight: 950, color: '#0F172A', margin: 0 }}>경로 기준</p>
            <span style={{ marginLeft: 'auto', background: manualStart ? '#F5F3FF' : '#F0FDFA', color: manualStart ? '#7C3AED' : '#0D9488', fontSize: 11, fontWeight: 900, padding: '4px 8px', borderRadius: 20 }}>
              {manualStart ? '출발지 직접 지정' : '현재 위치'}
            </span>
          </div>

          {[
            { type: 'start', label: '출발지', value: manualStart?.name || '현재 위치', sub: manualStart?.address || (liveCoords ? 'GPS 기준' : '직접 지정 가능'), color: manualStart ? '#7C3AED' : '#2563EB' },
            { type: 'via', label: '경유지', value: viaPlace?.name || '없음', sub: viaPlace?.address || '선택 사항', color: '#D97706' },
          ].map(row => (
            <div key={row.type} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10, alignItems: 'center', padding: row.type === 'start' ? '0 0 10px' : '10px 0 0', borderTop: row.type === 'via' ? '1px solid #F1F5F9' : 'none' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: row.color, boxShadow: `0 0 0 4px ${row.type === 'via' ? '#FEF3C7' : '#EFF6FF'}` }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: '#64748B', fontWeight: 900, margin: '0 0 2px' }}>{row.label}</p>
                <p style={{ fontSize: 16, color: '#0F172A', fontWeight: 950, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</p>
                <p style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {row.type === 'start' && manualStart && (
                  <button onClick={() => clearRoutePoint('start')} aria-label="출발지를 현재 위치로 되돌리기" style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', borderRadius: 12, padding: '9px 10px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>현재위치</button>
                )}
                {row.type === 'via' && viaPlace && (
                  <button onClick={() => clearRoutePoint('via')} aria-label="경유지 삭제" style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', borderRadius: 12, padding: '9px 10px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>삭제</button>
                )}
                <button onClick={() => openPointEditor(row.type)} aria-label={`${row.label} ${row.type === 'via' && !viaPlace ? '추가' : '변경'}`} style={{ border: 'none', background: row.type === 'start' ? '#0D9488' : '#FFF7ED', color: row.type === 'start' ? '#fff' : '#C2410C', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 950, cursor: 'pointer' }}>
                  {row.type === 'start' ? '변경' : (viaPlace ? '변경' : '추가')}
                </button>
              </div>
            </div>
          ))}

          {pointEditor && (
            <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #CBD5E1', borderRadius: 14, padding: '0 12px' }}>
                  <SearchIcon size={18} color="#64748B" stroke={2} />
                  <input
                    value={pointQuery}
                    onChange={e => setPointQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchRoutePoint()}
                    placeholder={pointEditor === 'start' ? '출발지 검색' : '경유지 검색'}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', minHeight: 48, fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: 'inherit' }}
                  />
                </div>
                <button onClick={searchRoutePoint} disabled={pointSearching} style={{ border: 'none', background: '#0D9488', color: '#fff', borderRadius: 14, height: 50, padding: '0 16px', fontSize: 14, fontWeight: 950, cursor: pointSearching ? 'default' : 'pointer', opacity: pointSearching ? 0.65 : 1 }}>
                  검색
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {QUICK_ROUTE_POINTS.map(point => (
                  <button key={point.name} onClick={() => applyRoutePoint(point, pointEditor)} style={{ border: '1px solid #CCFBF1', background: '#fff', color: '#0F766E', borderRadius: 20, padding: '8px 11px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                    {point.name}
                  </button>
                ))}
              </div>

              {pointSuggestions.length > 0 && (
                <div style={{ marginTop: 10, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                  {pointSuggestions.map((place, i) => (
                    <button
                      key={`${place.name}-${i}`}
                      onClick={() => !place.isLoading && !place.isEmpty && applyRoutePoint(place, pointEditor)}
                      disabled={place.isLoading || place.isEmpty}
                      style={{ width: '100%', border: 'none', background: '#fff', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', cursor: place.isLoading || place.isEmpty ? 'default' : 'pointer', opacity: place.isEmpty ? 0.65 : 1, fontFamily: 'inherit' }}
                    >
                      <MapPin size={18} color="#0D9488" stroke={2} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 15, color: '#0F172A', fontWeight: 950, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</p>
                        {place.address && <p style={{ fontSize: 12, color: '#64748B', fontWeight: 700, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.address}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {destinationCategory && !hasFixedDestination && (
            <div style={{
              marginTop: 12,
              background: resolvedDestinationPlace ? '#F0FDFA' : '#F8FAFC',
              border: `1px solid ${resolvedDestinationPlace ? '#CCFBF1' : '#E2E8F0'}`,
              borderRadius: 14,
              padding: '11px 12px',
            }}>
              <p style={{ fontSize: 13, color: resolvedDestinationPlace ? '#0F766E' : '#475569', fontWeight: 900, margin: '0 0 3px' }}>
                {destinationResolving ? '출발지 근처 목적지를 다시 찾는 중' : '출발지 기준 근처 검색'}
              </p>
              <p style={{ fontSize: 12, color: '#64748B', fontWeight: 700, lineHeight: 1.45, margin: 0 }}>
                {destinationResolveNote || `출발지를 바꾸면 그 위치 근처의 ${destinationCategory}으로 목적지를 다시 맞춰요.`}
              </p>
              {resolvedDestinationPlace?.address && (
                <p style={{ fontSize: 12, color: '#0F766E', fontWeight: 800, lineHeight: 1.45, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {resolvedDestinationPlace.address}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 이동 안전 체크 ── */}
        <div style={{ order: 4, background: b.bg, border: `1.5px solid ${b.border}`, borderRadius: 22, padding: '22px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <span style={{ background: '#fff', color: b.text, fontSize: 13, fontWeight: 900, padding: '5px 11px', borderRadius: 20, border: `1px solid ${b.border}` }}>이동 부담도</span>
              <p style={{ fontSize: 28, fontWeight: 900, color: b.text, margin: '11px 0 5px', lineHeight: 1.15 }}>{b.label}</p>
              <p style={{ fontSize: 16, color: b.accent, margin: 0, fontWeight: 800 }}>{b.sub}</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '13px 14px', textAlign: 'center', border: `1px solid ${b.border}`, minWidth: 104 }}>
              <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 3px', fontWeight: 800 }}>{isWalkOnlyRoute ? '도보 거리' : isLive ? '직선 거리' : '예상 거리'}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {routeData?.walkDistance >= 1000
                  ? <>{(routeData.walkDistance / 1000).toFixed(1)}<span style={{ fontSize: 12 }}>km</span></>
                  : <>{routeData?.walkDistance}<span style={{ fontSize: 12 }}>m</span></>
                }
              </p>
              {isLive && <p style={{ fontSize: 11, color: '#0D9488', margin: '3px 0 0', fontWeight: 800 }}>{routeData?.coordSource === 'manual' ? '좌표 측정' : 'GPS 측정'}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(isWalkOnlyRoute
              ? [
                { Icon: MapPin, label: `${formatDistance(displayPrimaryWalk)} 도보`, ok: true },
                { Icon: WindIcon, label: `대기질 ${air?.grade || '보통'}`, ok: !air?.airAlert },
                { Icon: ShelterIcon, label: profile.needRestStops ? '쉼터 확인' : '쉬어가기', ok: true },
              ]
              : [
                { Icon: BusIcon,      label: routeData?.lowFloorBus ? '저상버스 있음' : '저상버스 없음', ok: routeData?.lowFloorBus },
                { Icon: ElevatorIcon, label: routeData?.elevator ? '승강기 정상' : '승강기 점검', ok: routeData?.elevator },
                { Icon: WindIcon,     label: air?.grade || '보통', ok: !air?.airAlert },
              ]
            ).map(({ Icon, label, ok }, i) => (
              <div key={i} style={{ flex: 1, background: '#fff', border: `1px solid ${b.border}`, borderRadius: 14, padding: '12px 8px', textAlign: 'center', minHeight: 76 }}>
                <Icon size={22} color={ok ? b.accent : '#DC2626'} stroke={2} />
                <p style={{ fontSize: 13, fontWeight: 800, color: ok ? '#374151' : '#DC2626', margin: '7px 0 0', lineHeight: 1.3 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ② 지도 ── */}
        <div style={{ order: 3 }}>
          <RouteMap
            destination={destination}
            searchKeyword={destinationSearchKeyword}
            placeCoords={placeCoords}
            startPlace={manualStart}
            viaPlace={viaPlace}
            routeGuide={mapRouteGuide}
            routeMode={isWalkOnlyRoute ? 'walk' : 'transit'}
            currentStepIndex={activeGuideIndex}
            onStepSelect={setCurrentGuideStep}
            onCoordsReady={handleCoordsReady}
          />
        </div>

        {/* ── ③ 경고 배너 ── */}
        {routeData?.weatherAlert && (
          <div style={{ order: 2, background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertIcon size={18} color="#D97706" />
            <p style={{ color: '#92400E', fontWeight: 600, fontSize: 14, margin: 0 }}>{routeData.weatherAlert}</p>
          </div>
        )}

        {/* ── ④ 전체 경로 ── */}
        {routeData && (
          <div style={{ order: 1, background: '#fff', border: '2px solid #99F6E4', borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 24px rgba(13,148,136,0.10)' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: isWalkOnlyRoute ? '#2563EB' : hasExactRoute ? '#059669' : '#F59E0B', animation: hasExactRoute && !isWalkOnlyRoute ? 'liveP 1.5s infinite' : 'none' }} />
              <p style={{ fontWeight: 900, fontSize: 15, color: '#0F172A', margin: 0 }}>{isWalkOnlyRoute ? '도보 전용 안내' : hasExactRoute ? '정확한 전체 경로' : '전체 경로 안내'}</p>
              <span style={{ marginLeft: 'auto', background: isWalkOnlyRoute ? '#EFF6FF' : hasExactRoute ? '#F0FDFA' : '#FFF7ED', color: isWalkOnlyRoute ? '#2563EB' : hasExactRoute ? '#059669' : '#C2410C', fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20 }}>
                {routeBadge}
              </span>
            </div>

            {/* 경로 선택 탭 */}
            {!isWalkOnlyRoute && transitRoutes?.length > 1 && (
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F8FAFC' }}>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {transitRoutes.map((r, i) => {
                    const criteria = getRouteCriteria(r, i, transitRoutes, profile)
                    const active = selectedRoute === i
                    return (
                      <button key={i} onClick={() => setSelectedRoute(i)} style={{
                        minWidth: 112,
                        padding: '10px 12px',
                        borderRadius: 18,
                        border: active ? `2px solid ${criteria.color}` : '1px solid #E2E8F0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: active ? criteria.color : '#F8FAFC',
                        color: active ? '#fff' : '#334155',
                        transition: 'all 0.15s',
                        boxShadow: active ? '0 8px 18px rgba(13,148,136,0.18)' : 'none',
                      }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 950, marginBottom: 5 }}>
                          {i + 1}안 · {criteria.short}
                        </span>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 950, lineHeight: 1.15 }}>
                          {pathTypeIcon(r.pathType)} {r.totalTime}분
                        </span>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 800, opacity: active ? 0.9 : 0.72, marginTop: 5 }}>
                          도보 {routeDistanceLabel(r.totalWalk)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ padding: '14px 16px' }}>
              {hasExactRoute && selectedCriteria && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedCriteria.color, flexShrink: 0 }} />
                    <p style={{ fontSize: 14, fontWeight: 950, color: '#0F172A', margin: 0 }}>{selectedRoute + 1}안 기준: {selectedCriteria.label}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', lineHeight: 1.45, margin: 0 }}>{selectedCriteria.desc}</p>
                </div>
              )}

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: '11px 12px', marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 950, color: '#0F172A', margin: '0 0 6px' }}>공공데이터 반영</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(isWalkOnlyRoute
                    ? ['도보 거리', air?.grade ? `대기질 ${air.grade}` : '대기질', '쉼터·응급 정보']
                    : ['대중교통 경로', '버스·지하철 실시간', '승강기·대기질']
                  ).map(item => (
                    <span key={item} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20, color: '#475569', fontSize: 12, fontWeight: 900, padding: '5px 9px' }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* 요약 정보 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { label: '총 소요', value: `${displayPrimaryTime}분`, color: '#0D9488' },
                  { label: '전체 도보', value: formatDistance(displayPrimaryWalk), color: '#374151' },
                  { label: '요금', value: isWalkOnlyRoute ? '없음' : (bestRoute?.totalFare ? `${bestRoute.totalFare.toLocaleString()}원` : '확인 중'), color: '#7C3AED' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, background: '#F8F9FA', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color, margin: '4px 0 0' }}>{value}</p>
                  </div>
                ))}
              </div>

              {activeGuide && (
                <div style={{ background: '#0F172A', borderRadius: 18, padding: 16, marginBottom: 14, color: '#fff', boxShadow: '0 12px 28px rgba(15,23,42,0.20)', scrollMarginTop: 96 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 950, color: '#99F6E4', margin: 0 }}>바로 안내</p>
                    <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 20, padding: '4px 9px', fontSize: 12, fontWeight: 950 }}>
                      {activeGuideIndex + 1} / {guideSteps.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 15, background: '#fff', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {activeGuide.icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h2 style={{ fontSize: 23, fontWeight: 950, lineHeight: 1.2, margin: '0 0 7px', letterSpacing: 0 }}>{activeGuide.title}</h2>
                      {activeGuide.meta && <p style={{ fontSize: 14, fontWeight: 900, color: '#99F6E4', margin: '0 0 6px' }}>{activeGuide.meta}</p>}
                      <p style={{ fontSize: 16, fontWeight: 750, color: '#E2E8F0', lineHeight: 1.45, margin: 0 }}>{activeGuide.body}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, marginTop: 14 }}>
                    <button onClick={() => setCurrentGuideStep(step => Math.max(0, step - 1))} disabled={activeGuideIndex === 0} style={{ minHeight: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', background: activeGuideIndex === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 14, fontWeight: 950, padding: '0 13px', cursor: activeGuideIndex === 0 ? 'default' : 'pointer', opacity: activeGuideIndex === 0 ? 0.45 : 1 }}>
                      이전
                    </button>
                    <button onClick={() => speakGuideStep(activeGuide)} style={{ minHeight: 48, borderRadius: 14, border: 'none', background: '#14B8A6', color: '#fff', fontSize: 15, fontWeight: 950, cursor: 'pointer' }}>
                      음성으로 듣기
                    </button>
                    <button onClick={() => setCurrentGuideStep(step => Math.min(guideSteps.length - 1, step + 1))} disabled={activeGuideIndex >= guideSteps.length - 1} style={{ minHeight: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', background: activeGuideIndex >= guideSteps.length - 1 ? 'rgba(255,255,255,0.08)' : '#fff', color: activeGuideIndex >= guideSteps.length - 1 ? '#fff' : '#0F172A', fontSize: 14, fontWeight: 950, padding: '0 13px', cursor: activeGuideIndex >= guideSteps.length - 1 ? 'default' : 'pointer', opacity: activeGuideIndex >= guideSteps.length - 1 ? 0.45 : 1 }}>
                      다음
                    </button>
                  </div>
                  {activeGuide.detail && (
                    <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 800, color: '#BAE6FD', lineHeight: 1.45 }}>
                      {activeGuide.detail}
                    </p>
                  )}
                </div>
              )}

              {!hasExactRoute && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 14, color: '#9A3412', fontWeight: 900, margin: '0 0 4px' }}>{noExactTitle}</p>
                  <p style={{ fontSize: 13, color: '#C2410C', fontWeight: 700, lineHeight: 1.5, margin: 0 }}>{noExactBody}</p>
                </div>
              )}

              {memo && (
                <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: '#92400E', fontWeight: 900, margin: '0 0 4px' }}>보호자 메모 반영됨</p>
                  <p style={{ fontSize: 14, color: '#78350F', fontWeight: 700, lineHeight: 1.55, margin: 0 }}>{memoShort}</p>
                </div>
              )}

              {/* 단계별 전체 경로 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fullRouteSteps.map((step, i) => {
                  const walkText = step.type === 'walk' ? getWalkText(step, i, fullRouteSteps) : null
                  return (
                    <div key={`${step.type}-${i}`} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: step.type === 'walk' ? '#E0F2FE' : step.type === 'bus' ? '#ECFDF5' : '#EFF6FF', color: step.type === 'walk' ? '#0369A1' : step.type === 'bus' ? '#047857' : '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 950, border: '1px solid #E2E8F0' }}>
                          {i + 1}
                        </div>
                        {i < fullRouteSteps.length - 1 && <div style={{ flex: 1, width: 2, background: '#E2E8F0', marginTop: 6 }} />}
                      </div>

                      {step.type === 'walk' ? (
                        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '13px 14px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 17 }}>🚶</span>
                            <span style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>{walkText.title}</span>
                            {walkText.meta && <span style={{ fontSize: 12, color: '#64748B', marginLeft: 'auto', fontWeight: 800 }}>{walkText.meta}</span>}
                          </div>
                          <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.45 }}>{walkText.detail}</p>
                        </div>
                      ) : step.type === 'bus' ? (
                        <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '13px 14px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 16 }}>🚌</span>
                            <span style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>버스 탑승</span>
                            <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto', fontWeight: 800 }}>
                              {step.sectionTime ? `${step.sectionTime}분` : step.fallbackArrival || ''}{step.stationCount ? ` · ${step.stationCount}정류장` : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            {step.lines?.map((l, j) => (
                              <span key={j} style={{ background: '#374151', color: '#fff', fontSize: 13, fontWeight: 800, padding: '4px 12px', borderRadius: 8 }}>
                                {l.busNo}
                                <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.75, marginLeft: 4 }}>{l.typeLabel}</span>
                              </span>
                            ))}
                          </div>
                          <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                            <span style={{ fontWeight: 700, color: '#059669' }}>{step.startStationName || step.startName}</span>
                            {' '} 승차 → <span style={{ fontWeight: 700 }}>{step.endName}</span> 하차
                          </p>
                          {summarizeStops(step.passStops) && (
                            <div style={{ marginTop: 9, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '9px 10px' }}>
                              <p style={{ fontSize: 11, color: '#64748B', fontWeight: 900, margin: '0 0 4px' }}>지나는 정류장</p>
                              <p style={{ fontSize: 12, color: '#334155', fontWeight: 800, margin: 0, lineHeight: 1.45 }}>
                                {summarizeStops(step.passStops, 6)}
                              </p>
                            </div>
                          )}
                          {/* 이 정류장 실시간 버스 도착 */}
                          {i === firstBusStepIndex && realtimeBus?.length > 0 && (
                            <div style={{ marginTop: 10, background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', animation: 'liveP 1.5s infinite' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>실시간 도착</span>
                              </div>
                              {realtimeBus.slice(0, 3).map((bus, k) => (
                                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: k > 0 ? '1px solid #F8FAFC' : 'none' }}>
                                  <span style={{ background: '#374151', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 6, minWidth: 44, textAlign: 'center' }}>{bus.busNo}</span>
                                  {bus.isLowFloor && <span style={{ background: '#F0FDFA', color: '#0D9488', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>저상 ♿</span>}
                                  <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#0D9488' }}>
                                    {formatArrivalTime(bus.predictTime1, bus.locationNo1)}
                                  </span>
                                  {bus.remainSeat > 0 && <span style={{ fontSize: 11, color: '#94A3B8' }}>잔여 {bus.remainSeat}석</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '13px 14px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 16 }}>🚇</span>
                            <span style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>지하철 탑승</span>
                            <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto', fontWeight: 800 }}>
                              {step.sectionTime ? `${step.sectionTime}분` : step.fallbackExit || ''}{step.stationCount ? ` · ${step.stationCount}정류장` : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            {step.lines?.map((l, j) => (
                              <span key={j} style={{ background: l.color, color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 8 }}>
                                {l.name}
                              </span>
                            ))}
                          </div>
                          <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                            <span style={{ fontWeight: 700, color: '#2563EB' }}>{step.startName}</span>
                            {step.way && <span style={{ color: '#94A3B8' }}> ({step.way} 방면)</span>}
                            {' '} → <span style={{ fontWeight: 700 }}>{step.endName}</span>
                          </p>
                          {summarizeStops(step.passStops) && (
                            <div style={{ marginTop: 9, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '9px 10px' }}>
                              <p style={{ fontSize: 11, color: '#64748B', fontWeight: 900, margin: '0 0 4px' }}>지나는 역</p>
                              <p style={{ fontSize: 12, color: '#334155', fontWeight: 800, margin: 0, lineHeight: 1.45 }}>
                                {summarizeStops(step.passStops, 6)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <style>{`@keyframes liveP { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
          </div>
        )}

        {/* ── ⑤ 이동수단 탭 ── */}
        {!isWalkOnlyRoute && <div style={{ order: 5, background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '15px 16px 10px' }}>
            <p style={{ fontSize: 13, color: '#64748B', fontWeight: 900, margin: '0 0 3px' }}>추가 교통 정보</p>
            <p style={{ fontSize: 19, color: '#0F172A', fontWeight: 950, margin: 0 }}>다른 이동 방법도 확인하세요</p>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9' }}>
            {[
              { id: 'bus',    label: '🚌 버스' },
              { id: 'subway', label: '🚇 지하철' },
              { id: 'taxi',   label: '🚕 택시' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '15px 4px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 17, fontWeight: activeTab === tab.id ? 900 : 800,
                color: activeTab === tab.id ? '#0D9488' : '#94A3B8',
                borderBottom: activeTab === tab.id ? '3px solid #0D9488' : '3px solid transparent',
                transition: 'all 0.15s',
                minHeight: 58,
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─ 버스 패널 ─ */}
          {activeTab === 'bus' && (
            <div>
              {realtimeBus?.length > 0 ? (
                <>
                  <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', animation: 'liveP 1.5s infinite' }} />
                    <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>실시간 버스 도착 정보</span>
                  </div>
                  {realtimeBus.map((bus, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderTop: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ background: '#374151', color: '#fff', fontWeight: 800, fontSize: 14, padding: '6px 12px', borderRadius: 10, minWidth: 52, textAlign: 'center' }}>{bus.busNo}</span>
                      {bus.isLowFloor && <span style={{ background: '#F0FDFA', color: '#0D9488', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>저상 ♿</span>}
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: '#0D9488', margin: 0 }}>
                          {formatArrivalTime(bus.predictTime1, bus.locationNo1)}
                        </p>
                        {bus.predictTime2 && <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>다음: {formatArrivalTime(bus.predictTime2, 0)}</p>}
                        {bus.remainSeat > 0 && <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>잔여 {bus.remainSeat}석</p>}
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #F8FAFC', background: '#F8F9FA' }}>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>💡 초록 저상버스는 휠체어·유모차 이용 가능해요</p>
                  </div>
                </>
              ) : routeData?.buses?.length > 0 ? (
                <>
                  <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>근처 버스 안내</span>
                    {!liveCoords && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#C2410C', background: '#FFF7ED', padding: '2px 8px', borderRadius: 20 }}>위치 허용 시 실시간 전환</span>}
                  </div>
                  {routeData.buses.map((bus, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderTop: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ background: bus.isLowFloor ? '#0D9488' : '#374151', color: '#fff', fontWeight: 800, fontSize: 14, padding: '6px 12px', borderRadius: 10, minWidth: 52, textAlign: 'center' }}>{bus.busNo}</span>
                      {bus.isLowFloor && <span style={{ background: '#F0FDFA', color: '#0D9488', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>저상 ♿</span>}
                      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{bus.arrmsg1}</span>
                    </div>
                  ))}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #F8FAFC', background: '#F8F9FA' }}>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>💡 위치 허용 후 경로 재검색 시 실시간 데이터로 전환돼요</p>
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>버스 정보를 불러오는 중이에요</div>
              )}
            </div>
          )}

          {/* ─ 지하철 패널 ─ */}
          {activeTab === 'subway' && (
            <div>
              {subwayGuide ? (
                <>
                  <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, background: subwayGuide.lineColor,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, boxShadow: `0 4px 12px ${subwayGuide.lineColor}55`,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>서울</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{subwayGuide.line}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{subwayGuide.nearestStation}</p>
                      <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0', fontWeight: 600 }}>하차 후 {subwayGuide.walkFromExit}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', background: subwayGuide.lineColor + '15', borderRadius: 12, padding: '8px 12px', border: `1px solid ${subwayGuide.lineColor}30`, textAlign: 'right' }}>
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 2px', fontWeight: 600 }}>방향</p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: subwayGuide.lineColor, margin: 0 }}>{subwayGuide.direction}</p>
                    </div>
                  </div>

                  <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { icon: '🚉', label: '탑승역', value: subwayGuide.nearestStation },
                      { icon: '🧭', label: '탑승 방향', value: subwayGuide.direction + ' 방향' },
                      { icon: '🔄', label: '환승', value: subwayGuide.transferInfo || '환승 없음 (직통)' },
                      { icon: '🚪', label: '출구', value: subwayGuide.exitNumber + ' 이용' },
                    ].map(({ icon, label, value }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F9FA', borderRadius: 12, padding: '10px 14px' }}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, minWidth: 48 }}>{label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {realtimeArrivals?.length > 0 && (
                    <div style={{ margin: '0 16px 12px', background: '#F8F9FA', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', animation: 'liveP 1.5s infinite' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>실시간 도착 정보</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>{subwayGuide.nearestStation}</span>
                      </div>
                      {realtimeArrivals.map((arr, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderBottom: i < realtimeArrivals.length - 1 ? '1px solid #F1F5F9' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 20, borderRadius: 6, background: arr.lineColor || subwayGuide.lineColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{arr.lineName || subwayGuide.line}</span>
                          </div>
                          <span style={{ fontSize: 13, color: '#374151', fontWeight: 600, flex: 1 }}>{arr.direction || arr.bstatnNm}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#0D9488' }}>{arr.arrivalMsg}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {subwayGuide.tip && (
                    <div style={{ margin: '0 16px 14px', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>♿</span>
                      <p style={{ fontSize: 13, color: '#0F766E', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>{subwayGuide.tip}</p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#0D9488', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>지하철 경로 분석 중…</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
              )}
            </div>
          )}

          {/* ─ 택시 패널 ─ */}
          {activeTab === 'taxi' && (
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="tel:1588-4388" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#F0FDFA', border: '1.5px solid #CCFBF1', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.26 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.17 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>서울시 어르신 콜택시</p>
                    <p style={{ fontSize: 13, color: '#0D9488', fontWeight: 700, margin: '2px 0 0' }}>☎ 1588-4388</p>
                    <p style={{ fontSize: 11, color: '#64748B', margin: '3px 0 0' }}>65세 이상 · 24시간 운영 · 저렴한 요금</p>
                  </div>
                  <div style={{ background: '#0D9488', borderRadius: 10, padding: '6px 12px' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>전화</span>
                  </div>
                </div>
              </a>
              <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, color: '#92400E', fontWeight: 900, margin: '0 0 5px' }}>공공 이동지원 우선</p>
                <p style={{ fontSize: 13, color: '#78350F', fontWeight: 700, lineHeight: 1.5, margin: 0 }}>
                  일반 택시 호출 앱 대신 서울시 어르신 콜택시와 대중교통 접근성 정보를 먼저 안내해요.
                </p>
              </div>
              <div style={{ background: '#F8F9FA', borderRadius: 12, padding: '14px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 10px' }}>택시 요금 안내</p>
                <div style={{ display: 'flex' }}>
                  {[
                    { label: '기본요금', value: '4,800원' },
                    { label: '심야할증', value: '오후 10시~' },
                    { label: '어르신 할인', value: '복지콜 적용', color: '#0D9488' },
                  ].map(({ label, value, color }, i, arr) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #E2E8F0' : 'none', padding: '0 8px' }}>
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: color || '#0F172A', margin: '4px 0 0' }}>{value}</p>
                    </div>
                  ))}
                </div>
                {liveCoords?.dist && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>📍 GPS 기준 예상 요금</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                      {liveCoords.dist < 1600 ? '4,800원'
                        : `약 ${Math.round((4800 + Math.ceil((liveCoords.dist - 1600) / 131) * 100) / 100) * 100}원`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>}

        {/* ── 무더위쉼터 ── */}
        {routeData?.shelters?.length > 0 && (
          <div style={{ order: 8, background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #FEF3C7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShelterIcon size={16} color="#D97706" />
              <p style={{ fontWeight: 700, fontSize: 14, color: '#92400E', margin: 0 }}>근처 무더위쉼터</p>
            </div>
            {routeData.shelters.map((s, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: i < routeData.shelters.length - 1 ? '1px solid #FEF3C7' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <ShelterIcon size={16} color="#D97706" />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>{s.name}</p>
                  {s.address && <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{s.address}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255,255,255,0.98)',
          borderTop: '1px solid #E2E8F0',
          boxShadow: '0 -10px 28px rgba(15,23,42,0.1)',
          padding: '10px 14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 40,
        }}>
          {autoShared && (
            <div style={{
              border: '1px solid #CCFBF1',
              borderRadius: 14,
              background: '#F0FDFA',
              color: '#0F766E',
              fontWeight: 800,
              fontSize: 13,
              padding: '10px 12px',
              textAlign: 'center',
            }}>
              보호자 화면에 이동 기록이 자동 공유됐어요
            </div>
          )}
          <button onClick={() => navigate('/emergency')} style={{ width: '100%', border: '1.5px solid #FECACA', borderRadius: 16, background: '#FEF2F2', color: '#B91C1C', fontWeight: 900, fontSize: 17, padding: '16px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <AlertIcon size={19} color="#DC2626" stroke={2} /> 응급
          </button>
        </div>
      </div>
    </div>
  )
}
