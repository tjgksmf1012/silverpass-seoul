import { useEffect, useRef, useState } from 'react'

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY
const SEOUL_CENTER = { lat: 37.5665, lng: 126.9780 }
const SEOUL_BOUNDS = {
  minLat: 37.413,
  maxLat: 37.715,
  minLng: 126.734,
  maxLng: 127.269,
}

let sdkPromise = null
function loadKakaoSDK() {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps?.services) { resolve(); return }
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`
    script.onload = () => { window.kakao.maps.load(() => resolve()) }
    script.onerror = () => { sdkPromise = null; reject(new Error('카카오맵 SDK 로드 실패')) }
    document.head.appendChild(script)
  })
  return sdkPromise
}

function destOverlayHtml(name) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(13,148,136,0.35));">
      <div style="background:#0D9488;color:#fff;font-size:12px;font-weight:700;font-family:'Pretendard Variable','맑은 고딕',sans-serif;padding:5px 10px;border-radius:20px;white-space:nowrap;border:2px solid #fff;">${name}</div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #0D9488;margin-top:-1px;"></div>
    </div>
  `
}

function pointOverlayHtml(name, color) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(37,99,235,0.4));">
      <div style="background:${color};color:#fff;font-size:11px;font-weight:700;font-family:'Pretendard Variable','맑은 고딕',sans-serif;padding:4px 9px;border-radius:20px;border:2px solid #fff;white-space:nowrap;">${name}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-1px;"></div>
    </div>
  `
}

function drawRouteGuideLine(kakao, map, path) {
  return new kakao.maps.Polyline({
    map,
    path,
    strokeWeight: 5,
    strokeColor: '#0D9488',
    strokeOpacity: 0.78,
    strokeStyle: 'solid',
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

function createRoadLikePath(kakao, points) {
  const normalized = compactRoutePoints(points)
  if (normalized.length < 2) return normalized.map(point => toLatLng(kakao, point))

  const shaped = [normalized[0]]
  normalized.slice(1).forEach(point => {
    const prev = shaped[shaped.length - 1]
    const dLat = point.lat - prev.lat
    const dLng = point.lng - prev.lng
    shaped.push(
      { lat: prev.lat + dLat * 0.32, lng: prev.lng },
      { lat: prev.lat + dLat * 0.32, lng: prev.lng + dLng * 0.68 },
      { lat: prev.lat + dLat * 0.72, lng: prev.lng + dLng * 0.68 },
      point,
    )
  })

  return compactRoutePoints(shaped).map(point => toLatLng(kakao, point))
}

function createRouteGuidePath(kakao, basePoints, routeGuide) {
  const routePoints = compactRoutePoints(routeGuide?.routePoints || [])
  if (routePoints.length >= 2) {
    const points = compactRoutePoints([basePoints[0], ...routePoints, basePoints[basePoints.length - 1]])
    return {
      path: points.map(point => toLatLng(kakao, point)),
      source: 'transit',
    }
  }

  return {
    path: createRoadLikePath(kakao, basePoints),
    source: 'guide',
  }
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

function isInSeoul(lat, lng) {
  return lat >= SEOUL_BOUNDS.minLat &&
    lat <= SEOUL_BOUNDS.maxLat &&
    lng >= SEOUL_BOUNDS.minLng &&
    lng <= SEOUL_BOUNDS.maxLng
}

export default function RouteMap({ destination, searchKeyword, placeCoords, startPlace, viaPlace, routeGuide, onCoordsReady }) {
  const mapDivRef   = useRef(null)
  const mapRef      = useRef(null)
  const overlayRef  = useRef([])
  const polylineRef = useRef(null)
  const [status, setStatus]     = useState('loading')
  const [distInfo, setDistInfo] = useState(null)
  const [locationNote, setLocationNote] = useState('')

  useEffect(() => {
    if (!mapDivRef.current) return
    setDistInfo(null)
    setLocationNote('')
    if (!KAKAO_KEY) {
      setStatus('nokey')
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
      }
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
          if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null }
          mapRef.current = null
          mapDivRef.current.innerHTML = ''
        }

        const map = new kakao.maps.Map(mapDivRef.current, {
          center: new kakao.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
          level: 5,
        })
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
            const { path: linePath, source: lineSource } = createRouteGuidePath(kakao, basePoints, routeGuide)
            polylineRef.current = drawRouteGuideLine(kakao, map, linePath)

            const bounds = new kakao.maps.LatLngBounds()
            linePath.forEach(point => bounds.extend(point))
            map.setBounds(bounds, 60, 60, 60, 60)

            const dist = Math.round(getRouteDistance(basePoints) * 1.35)
            const duration = estimateDuration(dist)

            setDistInfo({ dist, duration })
            setLocationNote(lineSource === 'transit'
              ? '지도 선은 정류장과 역 좌표를 이어 표시해요. 자세한 순서는 아래 전체 경로를 확인하세요.'
              : '지도 선은 도로처럼 꺾어 보이도록 한 안내선이에요. 실제 순서는 아래 전체 경로를 확인하세요.'
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
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      overlayRef.current.forEach(o => { try { o.setMap(null) } catch {} })
      overlayRef.current = []
      if (polylineRef.current) { try { polylineRef.current.setMap(null) } catch {} polylineRef.current = null }
    }
  }, [destination, searchKeyword, placeCoords, startPlace, viaPlace, routeGuide])

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #F1F5F9',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid #F8FAFC',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>지도</p>

        {distInfo && (
          <div style={{ marginLeft: 8, display: 'flex', gap: 6 }}>
            <span style={{ background: '#F0FDFA', color: '#0D9488', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: '1px solid #CCFBF1' }}>
              📍 {distInfo.dist < 1000 ? `${distInfo.dist}m` : `${(distInfo.dist/1000).toFixed(1)}km`}
            </span>
            <span style={{ background: '#EFF6FF', color: '#2563EB', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: '1px solid #DBEAFE' }}>
              🕐 약 {distInfo.duration}분
            </span>
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
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={mapDivRef} style={{ height: 220 }} />

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

        {status === 'nokey' && (
          <div style={{
            position: 'absolute', inset: 0, background: '#F8F9FA',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>VITE_KAKAO_MAP_KEY 미설정</span>
            <span style={{ fontSize: 11, color: '#CBD5E1' }}>.env 파일에 카카오 앱키를 추가해주세요</span>
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
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid #F8FAFC' }}>
        <p style={{ fontSize: 11, color: locationNote ? '#94A3B8' : '#CBD5E1', margin: 0 }}>
          {locationNote || '지도 © Kakao'}
        </p>
      </div>
    </div>
  )
}
