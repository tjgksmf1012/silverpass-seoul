import { useEffect, useRef, useState } from 'react'

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY
const SEOUL_CENTER = { lat: 37.5665, lng: 126.9780 }
const SEOUL_BOUNDS = {
  minLat: 37.413,
  maxLat: 37.715,
  minLng: 126.734,
  maxLng: 127.269,
}
const STEP_STYLE = {
  walk: { label: '도보', icon: '🚶', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  bus: { label: '버스', icon: '🚌', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  subway: { label: '지하철', icon: '🚇', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
}

let sdkPromise = null
function loadKakaoSDK() {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps?.services) { resolve(); return }
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`
    script.onload = () => { window.kakao.maps.load(() => resolve()) }
    script.onerror = () => { sdkPromise = null; reject(new Error('카카오맵 SDK 로드 실패')) }
    document.head.appendChild(script)
  })
  return sdkPromise
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]))
}

function shortText(value = '', max = 18) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function destOverlayHtml(name) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(13,148,136,0.35));">
      <div style="background:#0D9488;color:#fff;font-size:12px;font-weight:700;font-family:'Pretendard Variable','맑은 고딕',sans-serif;padding:5px 10px;border-radius:20px;white-space:nowrap;border:2px solid #fff;">${escapeHtml(shortText(name, 20))}</div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #0D9488;margin-top:-1px;"></div>
    </div>
  `
}

function pointOverlayHtml(name, color) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(37,99,235,0.4));">
      <div style="background:${color};color:#fff;font-size:11px;font-weight:700;font-family:'Pretendard Variable','맑은 고딕',sans-serif;padding:4px 9px;border-radius:20px;border:2px solid #fff;white-space:nowrap;">${escapeHtml(shortText(name, 14))}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-1px;"></div>
    </div>
  `
}

function routeStepLabel(step) {
  if (!step) return '경로'
  if (step.type === 'walk') {
    const meters = Number(step.distance)
    return Number.isFinite(meters) && meters > 0 ? `${distanceLabel(meters)} 걷기` : '걷기'
  }
  if (step.type === 'bus') {
    return step.lines?.map(line => line.busNo).filter(Boolean).slice(0, 2).join(', ') || '버스'
  }
  return step.lines?.map(line => line.name).filter(Boolean).slice(0, 2).join(', ') || '지하철'
}

function stepOverlayHtml(step, index, active) {
  const style = STEP_STYLE[step?.type] || STEP_STYLE.walk
  const label = routeStepLabel(step)
  return `
    <div style="display:flex;align-items:center;gap:6px;filter:drop-shadow(0 5px 12px rgba(15,23,42,0.24));">
      <div style="width:28px;height:28px;border-radius:999px;background:${active ? style.color : '#fff'};color:${active ? '#fff' : style.color};border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;font-family:'Pretendard Variable','맑은 고딕',sans-serif;">${index + 1}</div>
      <div style="background:${active ? style.color : '#fff'};color:${active ? '#fff' : '#0F172A'};border:2px solid ${active ? '#fff' : style.border};border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;font-family:'Pretendard Variable','맑은 고딕',sans-serif;white-space:nowrap;">
        ${style.icon} ${escapeHtml(shortText(label, 16))}
      </div>
    </div>
  `
}

function stationDotHtml(step, name, active) {
  const style = STEP_STYLE[step?.type] || STEP_STYLE.bus
  return `
    <div style="display:flex;align-items:center;gap:5px;filter:drop-shadow(0 2px 5px rgba(15,23,42,0.18));">
      <span style="width:${active ? 10 : 8}px;height:${active ? 10 : 8}px;border-radius:999px;background:${style.color};border:2px solid #fff;display:block;"></span>
      ${active && name ? `<span style="background:#fff;color:#334155;border:1px solid #E2E8F0;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;font-family:'Pretendard Variable','맑은 고딕',sans-serif;white-space:nowrap;">${escapeHtml(shortText(name, 9))}</span>` : ''}
    </div>
  `
}

function stepEndOverlayHtml(step) {
  const style = STEP_STYLE[step?.type] || STEP_STYLE.walk
  const label = step?.type === 'bus' ? '내릴 곳' : step?.type === 'subway' ? '내릴 역' : '도보 끝'
  return `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(15,23,42,0.22));">
      <div style="background:#fff;color:${style.color};border:2px solid ${style.color};border-radius:999px;padding:5px 9px;font-size:12px;font-weight:900;font-family:'Pretendard Variable','맑은 고딕',sans-serif;white-space:nowrap;">${label}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${style.color};margin-top:-1px;"></div>
    </div>
  `
}

function drawRouteGuideLine(kakao, map, path, source, active = false) {
  const styles = {
    walk: { color: '#2563EB', weight: 5, opacity: 0.78, style: 'shortdash' },
    bus: { color: '#059669', weight: 6, opacity: 0.78, style: 'solid' },
    subway: { color: '#7C3AED', weight: 6, opacity: 0.78, style: 'solid' },
    flow: { color: '#0D9488', weight: 4, opacity: 0.62, style: 'shortdash' },
    guide: { color: '#64748B', weight: 3, opacity: 0.5, style: 'shortdash' },
  }
  const style = styles[source] || styles.guide
  return new kakao.maps.Polyline({
    map,
    path,
    strokeWeight: active ? style.weight + 2 : style.weight,
    strokeColor: style.color,
    strokeOpacity: active ? 0.96 : style.opacity,
    strokeStyle: style.style,
    zIndex: active ? 9 : 3,
  })
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

function toLatLng(kakao, point) {
  return new kakao.maps.LatLng(point.lat, point.lng)
}

function createDirectGuidePath(kakao, points) {
  const normalized = compactRoutePoints(points)
  return normalized.map(point => toLatLng(kakao, point))
}

function createRouteFlowPoints(routeGuide) {
  const stepPoints = compactRoutePoints((routeGuide?.steps || []).flatMap(step => [
    step.startPoint,
    step.endPoint,
  ]))
  if (stepPoints.length >= 2) return stepPoints

  const routePoints = compactRoutePoints(routeGuide?.routePoints || [])
  if (routePoints.length >= 2) return [routePoints[0], routePoints[routePoints.length - 1]]

  return []
}

function createRouteGuidePath(kakao, basePoints, routeGuide) {
  const flowPoints = createRouteFlowPoints(routeGuide)
  if (flowPoints.length >= 2) {
    const points = compactRoutePoints([basePoints[0], ...flowPoints, basePoints[basePoints.length - 1]])
    return {
      path: points.map(point => toLatLng(kakao, point)),
      source: 'flow',
    }
  }

  return {
    path: createDirectGuidePath(kakao, basePoints),
    source: 'guide',
  }
}

function createRouteGuideSegments(kakao, basePoints, routeGuide, routeMode) {
  if (routeMode === 'walk') {
    return [{
      source: 'walk',
      path: createDirectGuidePath(kakao, basePoints),
      step: routeGuide?.steps?.[0] || { type: 'walk', distance: routeGuide?.totalDistance },
      index: 0,
    }]
  }

  const stepSegments = (routeGuide?.steps || []).flatMap((step, index) => {
    const points = compactRoutePoints(step.routePoints?.length ? step.routePoints : [step.startPoint, step.endPoint])
    if (points.length < 2) return []
    return [{
      source: step.type === 'bus' ? 'bus' : step.type === 'subway' ? 'subway' : 'walk',
      path: points.map(point => toLatLng(kakao, point)),
      step,
      index,
    }]
  })
  if (stepSegments.length) return stepSegments

  const { path, source } = createRouteGuidePath(kakao, basePoints, routeGuide)
  return path.length >= 2 ? [{ path, source, step: null, index: 0 }] : []
}

function getRouteDistance(points) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180

  return points.slice(1).reduce((sum, point, index) => {
    const prev = points[index]
    const dLat = toRad(point.lat - prev.lat)
    const dLon = toRad(point.lng - prev.lng)
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(prev.lat)) * Math.cos(toRad(point.lat)) * Math.sin(dLon / 2) ** 2
    return sum + (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }, 0)
}

function estimateDuration(dist) {
  return Math.max(8, Math.min(Math.ceil(dist / 1000 / 20 * 60) + 5 + Math.ceil(dist / 1000), 90))
}

function distanceLabel(meters) {
  const value = Number(meters)
  if (!Number.isFinite(value)) return null
  return value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`
}

function isInSeoul(lat, lng) {
  return lat >= SEOUL_BOUNDS.minLat &&
    lat <= SEOUL_BOUNDS.maxLat &&
    lng >= SEOUL_BOUNDS.minLng &&
    lng <= SEOUL_BOUNDS.maxLng
}

function mapStepItems(routeGuide, routeMode) {
  const steps = routeGuide?.steps || []
  if (steps.length) return steps
  if (routeMode === 'walk') return [{ type: 'walk', distance: routeGuide?.totalDistance }]
  return []
}

function stepMetaLabel(step) {
  if (!step) return ''
  if (step.meta) return step.meta
  const parts = []
  if (step.sectionTime) parts.push(`${step.sectionTime}분`)
  if (step.type === 'walk' && Number(step.distance) > 0) parts.push(distanceLabel(step.distance))
  if (step.type === 'bus' && step.stationCount) parts.push(`${step.stationCount}정류장`)
  if (step.type === 'subway' && step.stationCount) parts.push(`${step.stationCount}개 역`)
  return parts.filter(Boolean).join(' · ')
}

function stepEndpointText(step) {
  if (!step) return ''
  if (step.detail) return step.detail
  const start = step.startStationName || step.startName || (step.type === 'walk' ? '출발지' : '타는 곳')
  const end = step.endName || (step.type === 'walk' ? '다음 지점' : '내릴 곳')
  if (step.type === 'walk') return `${start}에서 ${end}까지 걸어요.`
  if (step.type === 'bus') return `${start}에서 타고 ${end}에서 내리세요.`
  return `${start}에서 ${step.way ? `${step.way} 방면으로 ` : ''}타고 ${end}에서 내리세요.`
}

function stepActionTitle(step) {
  if (!step) return '경로 확인'
  if (step.title) return step.title
  if (step.type === 'walk') return `${distanceLabel(step.distance) || ''} 걷기`.trim()
  if (step.type === 'bus') return `${routeStepLabel(step)} 버스 타기`
  return `${routeStepLabel(step)} 타기`
}

function stepStopPreview(step) {
  if (!step || step.type === 'walk') return ''
  const stops = (step.passStops || []).filter(Boolean)
  if (!stops.length) return ''
  const label = step.type === 'subway' ? '지나는 역' : '지나는 정류장'
  const preview = stops.slice(0, 5).join(' → ')
  return stops.length > 5 ? `${label}: ${preview} 외 ${stops.length - 5}곳` : `${label}: ${preview}`
}

function pickStationDots(step, active) {
  const points = (step?.passStopPoints || []).filter(point =>
    Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
  ).map(point => ({
    lat: Number(point.lat),
    lng: Number(point.lng),
    name: point.name || '',
  })).reduce((acc, point) => {
    const prev = acc[acc.length - 1]
    if (!prev || Math.abs(prev.lat - point.lat) > 0.00001 || Math.abs(prev.lng - point.lng) > 0.00001) {
      acc.push(point)
    }
    return acc
  }, [])
  if (!points.length) return []
  const max = active ? 8 : 4
  const stride = Math.max(1, Math.ceil(points.length / max))
  return points.filter((_, index) => index % stride === 0).slice(0, max)
}

export default function RouteMap({
  destination,
  searchKeyword,
  placeCoords,
  startPlace,
  viaPlace,
  routeGuide,
  routeMode = 'guide',
  currentStepIndex = 0,
  onStepSelect,
  onStartRequest,
  onCoordsReady,
}) {
  const mapDivRef   = useRef(null)
  const mapRef      = useRef(null)
  const overlayRef  = useRef([])
  const polylineRef = useRef([])
  const lastStartRef = useRef(null)
  const [status, setStatus]     = useState('loading')
  const [distInfo, setDistInfo] = useState(null)
  const [locationNote, setLocationNote] = useState('')
  const [focusMode, setFocusMode] = useState('step')

  useEffect(() => {
    if (!mapDivRef.current) return
    setDistInfo(null)
    setLocationNote('')

    function useCoordinateFallback(message) {
      if (startPlace?.lat && startPlace?.lng && placeCoords?.lat && placeCoords?.lng) {
        const points = [
          { lat: startPlace.lat, lng: startPlace.lng },
          ...(viaPlace?.lat && viaPlace?.lng ? [{ lat: viaPlace.lat, lng: viaPlace.lng }] : []),
          { lat: placeCoords.lat, lng: placeCoords.lng },
        ]
        const dist = Math.round(getRouteDistance(points) * 1.35)
        setDistInfo({ dist, duration: estimateDuration(dist) })
        onCoordsReady?.({
          user: { lat: startPlace.lat, lng: startPlace.lng },
          via: viaPlace?.lat && viaPlace?.lng ? { lat: viaPlace.lat, lng: viaPlace.lng, name: viaPlace.name, address: viaPlace.address } : null,
          dest: { lat: placeCoords.lat, lng: placeCoords.lng },
          dist,
          duration: estimateDuration(dist),
          source: 'manual',
          startLabel: startPlace.name,
        })
      } else if (placeCoords?.lat && placeCoords?.lng) {
        setDistInfo(null)
      }
      setStatus(placeCoords?.lat && placeCoords?.lng ? 'fallback' : 'error')
      setLocationNote(message)
    }

    if (!KAKAO_KEY) {
      useCoordinateFallback('지도 키가 없어 좌표 기준으로 안내해요')
      return
    }

    let cancelled = false

    loadKakaoSDK()
      .then(() => {
        if (cancelled || !mapDivRef.current) return
        const { kakao } = window

        if (mapRef.current) {
          overlayRef.current.forEach(o => o.setMap(null))
          overlayRef.current = []
          polylineRef.current.forEach(line => { try { line.setMap(null) } catch {} })
          polylineRef.current = []
          mapRef.current = null
          mapDivRef.current.innerHTML = ''
        }

        const map = new kakao.maps.Map(mapDivRef.current, {
          center: new kakao.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
          level: 5,
        })
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
        mapRef.current = map

        // 목적지 좌표 확정 후 공통 처리
        function onDestKnown(destLat, destLng) {
          if (cancelled || !mapRef.current) return
          const destLatLng = new kakao.maps.LatLng(destLat, destLng)
          map.setCenter(destLatLng)
          map.setLevel(4)

          const destOverlay = new kakao.maps.CustomOverlay({
            position: destLatLng,
            content: destOverlayHtml(destination),
            yAnchor: 1.0,
          })
          destOverlay.setMap(map)
          overlayRef.current.push(destOverlay)
          setStatus('ready')

          function applyStart(start, source) {
            lastStartRef.current = { ...start, source }
            const startLatLng = new kakao.maps.LatLng(start.lat, start.lng)
            const viaLatLng = viaPlace?.lat && viaPlace?.lng
              ? new kakao.maps.LatLng(viaPlace.lat, viaPlace.lng)
              : null

            const startOverlay = new kakao.maps.CustomOverlay({
              position: startLatLng,
              content: pointOverlayHtml(source === 'manual' ? '출발지' : '현재 위치', source === 'manual' ? '#7C3AED' : '#2563EB'),
              yAnchor: 1.0,
            })
            startOverlay.setMap(map)
            overlayRef.current.push(startOverlay)

            if (viaLatLng) {
              const viaOverlay = new kakao.maps.CustomOverlay({
                position: viaLatLng,
                content: pointOverlayHtml('경유지', '#D97706'),
                yAnchor: 1.0,
              })
              viaOverlay.setMap(map)
              overlayRef.current.push(viaOverlay)
            }

            const basePoints = [
              { lat: start.lat, lng: start.lng },
              ...(viaPlace?.lat && viaPlace?.lng ? [{ lat: viaPlace.lat, lng: viaPlace.lng }] : []),
              { lat: destLat, lng: destLng },
            ]
            const segments = createRouteGuideSegments(kakao, basePoints, routeGuide, routeMode)
            const activeSegment = segments.find(segment => segment.index === currentStepIndex) || segments[0]
            segments.forEach(segment => {
              if (segment.path.length >= 2) {
                const active = segment.index === currentStepIndex
                polylineRef.current.push(drawRouteGuideLine(kakao, map, segment.path, segment.source, active))

                const stepOverlay = new kakao.maps.CustomOverlay({
                  position: segment.path[0],
                  content: stepOverlayHtml(segment.step, segment.index, active),
                  yAnchor: 1.45,
                  zIndex: active ? 30 : 20,
                })
                stepOverlay.setMap(map)
                overlayRef.current.push(stepOverlay)

                if (active && segment.path.length >= 2) {
                  const endOverlay = new kakao.maps.CustomOverlay({
                    position: segment.path[segment.path.length - 1],
                    content: stepEndOverlayHtml(segment.step),
                    yAnchor: 1.15,
                    zIndex: 28,
                  })
                  endOverlay.setMap(map)
                  overlayRef.current.push(endOverlay)
                }

                if (segment.step?.type !== 'walk') {
                  pickStationDots(segment.step, active).forEach(point => {
                    const stationOverlay = new kakao.maps.CustomOverlay({
                      position: new kakao.maps.LatLng(point.lat, point.lng),
                      content: stationDotHtml(segment.step, point.name, active),
                      yAnchor: 0.5,
                      zIndex: active ? 18 : 12,
                    })
                    stationOverlay.setMap(map)
                    overlayRef.current.push(stationOverlay)
                  })
                }
              }
            })

            const bounds = new kakao.maps.LatLngBounds()
            const focusStep = focusMode === 'step' && activeSegment?.path?.length >= 2
            const boundsPath = focusStep
              ? activeSegment.path
              : segments.length
              ? segments.flatMap(segment => segment.path)
              : [startLatLng, destLatLng]
            boundsPath.forEach(point => bounds.extend(point))
            map.setBounds(bounds, focusStep ? 86 : 60, focusStep ? 74 : 60, focusStep ? 86 : 60, focusStep ? 74 : 60)

            const dist = Math.round(getRouteDistance(basePoints) * 1.35)
            const duration = estimateDuration(dist)

            setDistInfo({ dist, duration })
            setLocationNote(routeMode === 'walk'
              ? '현재 도보 구간을 크게 보여줘요. 전체 경로가 필요하면 전체 보기를 누르세요.'
              : routeGuide?.steps?.length
                ? '현재 단계 위주로 확대돼요. 정류장·역 번호와 아래 안내를 함께 따라가세요.'
                : '지도 선은 좌표 기준 참고선이에요. 정확한 순서는 아래 전체 경로를 따르세요.'
            )
            onCoordsReady?.({
              user: { lat: start.lat, lng: start.lng },
              via: viaPlace?.lat && viaPlace?.lng ? { lat: viaPlace.lat, lng: viaPlace.lng, name: viaPlace.name, address: viaPlace.address } : null,
              dest: { lat: destLat, lng: destLng },
              dist,
              duration,
              source,
              startLabel: start.name || '',
            })
          }

          if (startPlace?.lat && startPlace?.lng) {
            applyStart(startPlace, 'manual')
            return
          }

          if (lastStartRef.current?.lat && lastStartRef.current?.lng && lastStartRef.current.source !== 'manual') {
            applyStart(lastStartRef.current, lastStartRef.current.source || 'gps')
            return
          }

          navigator.geolocation?.getCurrentPosition(
            pos => {
              if (cancelled || !mapRef.current) return
              const { latitude: lat, longitude: lon } = pos.coords
              if (!isInSeoul(lat, lon)) {
                setLocationNote('서울 밖 위치는 목적지 중심으로 표시해요')
                return
              }

              applyStart({ lat, lng: lon }, 'gps')
            },
            () => setLocationNote('위치 권한이 없어서 목적지 중심으로 표시해요'),
            { timeout: 5000 }
          )
        }

        // 카카오 검색 결과에서 좌표가 있으면 재검색 없이 바로 사용
        if (placeCoords) {
          onDestKnown(placeCoords.lat, placeCoords.lng)
        } else {
          const ps = new kakao.maps.services.Places()
          const queryText = searchKeyword || destination
          const keyword = String(queryText).includes('서울') ? queryText : `서울 ${queryText}`
          ps.keywordSearch(
            keyword,
            (data, searchStatus) => {
              if (cancelled || !mapRef.current) return
              if (searchStatus !== kakao.maps.services.Status.OK || !data.length) {
                setStatus('error'); return
              }
              onDestKnown(parseFloat(data[0].y), parseFloat(data[0].x))
            },
            { location: new kakao.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng), radius: 20000 }
          )
        }
      })
      .catch(() => {
        if (!cancelled) useCoordinateFallback('지도 SDK를 불러오지 못해 좌표 기준으로 안내해요')
      })

    return () => {
      cancelled = true
      overlayRef.current.forEach(o => { try { o.setMap(null) } catch {} })
      overlayRef.current = []
      polylineRef.current.forEach(line => { try { line.setMap(null) } catch {} })
      polylineRef.current = []
    }
  }, [destination, searchKeyword, placeCoords, startPlace, viaPlace, routeGuide, routeMode, currentStepIndex, focusMode])

  const routeDistance = Number(routeGuide?.totalDistance) > 0 ? Number(routeGuide.totalDistance) : distInfo?.dist
  const routeDuration = Number(routeGuide?.totalTime) > 0 ? Number(routeGuide.totalTime) : distInfo?.duration
  const hasRouteMetrics = Number(routeGuide?.totalDistance) > 0 || Number(routeGuide?.totalTime) > 0
  const routeDistanceText = distanceLabel(routeDistance)
  const stepsForMap = mapStepItems(routeGuide, routeMode)
  const hasStartForMap = Boolean(distInfo || (startPlace?.lat && startPlace?.lng))
  const safeStepIndex = stepsForMap.length ? Math.min(currentStepIndex, stepsForMap.length - 1) : 0
  const activeMapStep = stepsForMap[safeStepIndex]
  const activeStepStyle = STEP_STYLE[activeMapStep?.type] || STEP_STYLE.walk
  const activeStopPreview = stepStopPreview(activeMapStep)
  const canFocusStep = hasStartForMap && stepsForMap.length > 1

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #F1F5F9',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid #F8FAFC',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <p style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', margin: 0 }}>위치도</p>

        {(routeDistanceText || routeDuration) && (
          <div style={{ marginLeft: 8, display: 'flex', gap: 6 }}>
            {routeDistanceText && (
              <span style={{ background: '#F0FDFA', color: '#0D9488', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: '1px solid #CCFBF1' }}>
                {hasRouteMetrics ? '경로' : '직선'} {routeDistanceText}
              </span>
            )}
            {routeDuration && (
              <span style={{ background: '#EFF6FF', color: '#2563EB', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: '1px solid #DBEAFE' }}>
                약 {routeDuration}분
              </span>
            )}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0D9488', border: '2px solid #fff', boxShadow: '0 0 0 1px #0D9488' }} />
            <span style={{ fontSize: 11, color: '#64748B' }}>목적지</span>
          </span>
          {distInfo && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: startPlace ? '#7C3AED' : '#2563EB', border: '2px solid #fff', boxShadow: `0 0 0 1px ${startPlace ? '#7C3AED' : '#2563EB'}` }} />
              <span style={{ fontSize: 11, color: '#64748B' }}>{startPlace ? '출발지' : '현재 위치'}</span>
            </span>
          )}
          {viaPlace && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D97706', border: '2px solid #fff', boxShadow: '0 0 0 1px #D97706' }} />
              <span style={{ fontSize: 11, color: '#64748B' }}>경유지</span>
            </span>
          )}
        </div>

        {canFocusStep && (
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            {[
              { value: 'step', label: '현재 단계 크게' },
              { value: 'all', label: '전체 경로 보기' },
            ].map(mode => {
              const active = focusMode === mode.value
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setFocusMode(mode.value)}
                  style={{
                    minHeight: 38,
                    borderRadius: 12,
                    border: active ? '1.5px solid #0D9488' : '1px solid #E2E8F0',
                    background: active ? '#F0FDFA' : '#fff',
                    color: active ? '#0F766E' : '#475569',
                    fontSize: 13,
                    fontWeight: 950,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={mapDivRef} style={{ height: 320 }} />

        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, background: '#F8F9FA',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: '2px solid #E2E8F0', borderTopColor: '#0D9488',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: '#94A3B8' }}>지도 불러오는 중…</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {status === 'fallback' && (
          <div style={{
            position: 'absolute', inset: 0, background: '#F8F9FA',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: 18, textAlign: 'center',
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#0F172A' }}>{destination}</span>
            {placeCoords?.lat && placeCoords?.lng && (
              <span style={{ fontSize: 12, color: '#0D9488', fontWeight: 800 }}>
                좌표 확인됨 · {Number(placeCoords.lat).toFixed(4)}, {Number(placeCoords.lng).toFixed(4)}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
              {startPlace ? '출발지와 목적지 좌표로 경로를 계산하고 있어요.' : '출발지를 직접 지정하면 거리와 대중교통 경로를 더 정확히 계산해요.'}
            </span>
          </div>
        )}

        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, background: '#F8F9FA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>장소를 찾을 수 없어요</span>
          </div>
        )}

        {!hasStartForMap && status === 'ready' && (
          <div style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 14,
            background: 'rgba(255,251,235,0.97)',
            border: '1.5px solid #FED7AA',
            borderRadius: 16,
            padding: 12,
            boxShadow: '0 12px 26px rgba(146,64,14,0.18)',
            zIndex: 40,
            pointerEvents: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 13,
                background: '#FFF7ED',
                color: '#D97706',
                border: '1px solid #FED7AA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 950,
                flexShrink: 0,
              }}>
                📍
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 950, color: '#92400E', margin: '0 0 3px', lineHeight: 1.25 }}>
                  출발지를 지정하면 경로선이 보여요
                </p>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#B45309', margin: 0, lineHeight: 1.4 }}>
                  서울역처럼 출발지를 검색해 실제 정류장·도보 구간을 확인하세요.
                </p>
              </div>
            </div>
            {onStartRequest && (
              <button
                type="button"
                onClick={onStartRequest}
                style={{
                  width: '100%',
                  minHeight: 42,
                  marginTop: 10,
                  border: 'none',
                  borderRadius: 12,
                  background: '#D97706',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 950,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                출발지 지정하기
              </button>
            )}
          </div>
        )}
      </div>

      {hasStartForMap && activeMapStep && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #F1F5F9', background: '#FFFFFF' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'start' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: activeStepStyle.bg,
              color: activeStepStyle.color,
              border: `1px solid ${activeStepStyle.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 950,
            }}>
              {activeStepStyle.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <span style={{ color: activeStepStyle.color, background: activeStepStyle.bg, border: `1px solid ${activeStepStyle.border}`, borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 950 }}>
                  {safeStepIndex + 1}단계
                </span>
                {stepMetaLabel(activeMapStep) && (
                  <span style={{ color: '#64748B', fontSize: 12, fontWeight: 850 }}>
                    {stepMetaLabel(activeMapStep)}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 17, fontWeight: 950, color: '#0F172A', margin: '0 0 3px', lineHeight: 1.25 }}>
                {stepActionTitle(activeMapStep)}
              </p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#475569', margin: 0, lineHeight: 1.45 }}>
                {stepEndpointText(activeMapStep)}
              </p>
              {activeStopPreview && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748B', fontWeight: 800, lineHeight: 1.45 }}>
                  {activeStopPreview}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {hasStartForMap && stepsForMap.length > 0 && (
        <div style={{ padding: '11px 14px 10px', borderTop: '1px solid #F1F5F9', background: '#FBFDFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 950, color: '#0F172A', margin: 0 }}>지도에서 보는 순서</p>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#64748B' }}>
              {Math.min(currentStepIndex + 1, stepsForMap.length)} / {stepsForMap.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
            {stepsForMap.map((step, index) => {
              const style = STEP_STYLE[step.type] || STEP_STYLE.walk
              const active = index === currentStepIndex
              return (
                <button
                  key={`${step.type}-${index}`}
                  type="button"
                  onClick={() => onStepSelect?.(index)}
                  style={{
                    flex: '0 0 auto',
                    minHeight: 42,
                    borderRadius: 999,
                    border: `1.5px solid ${active ? style.color : style.border}`,
                    background: active ? style.color : '#fff',
                    color: active ? '#fff' : '#0F172A',
                    padding: '0 12px 0 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 12,
                    fontWeight: 950,
                    cursor: onStepSelect ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    boxShadow: active ? '0 7px 16px rgba(15,23,42,0.16)' : 'none',
                  }}
                >
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: active ? 'rgba(255,255,255,0.18)' : style.bg, color: active ? '#fff' : style.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                    {index + 1}
                  </span>
                  <span>{style.icon} {routeStepLabel(step)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ padding: '8px 14px', borderTop: '1px solid #F8FAFC' }}>
        <p style={{ fontSize: 11, color: locationNote ? '#94A3B8' : '#CBD5E1', margin: 0 }}>
          {locationNote || '지도 © Kakao'}
        </p>
      </div>
    </div>
  )
}
