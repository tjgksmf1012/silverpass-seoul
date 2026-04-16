/**
 * RouteMap — 카카오맵 기반 경로 지도
 * Kakao Maps JS SDK v2 (libraries=services 포함)
 */
import { useEffect, useRef, useState } from 'react'

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY
const SEOUL_CENTER = { lat: 37.5665, lng: 126.9780 }

// ─── 카카오맵 SDK 동적 로드 (중복 로드 방지) ───────────────────
let sdkPromise = null
function loadKakaoSDK() {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    // 이미 로드된 경우
    if (window.kakao?.maps?.services) { resolve(); return }

    const script = document.createElement('script')
    // autoload=false → kakao.maps.load() 콜백 후 사용 가능
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`
    script.onload = () => {
      window.kakao.maps.load(() => resolve())
    }
    script.onerror = () => {
      sdkPromise = null // 실패 시 재시도 허용
      reject(new Error('카카오맵 SDK 로드 실패'))
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

// ─── 목적지 커스텀 마커 HTML ─────────────────────────────────
function destOverlayHtml(name) {
  return `
    <div style="
      display:flex;flex-direction:column;align-items:center;
      filter:drop-shadow(0 3px 6px rgba(13,148,136,0.35));
    ">
      <div style="
        background:#0D9488;color:#fff;
        font-size:12px;font-weight:700;font-family:'Pretendard Variable','맑은 고딕',sans-serif;
        padding:5px 10px;border-radius:20px;white-space:nowrap;
        border:2px solid #fff;
      ">${name}</div>
      <div style="
        width:0;height:0;
        border-left:7px solid transparent;
        border-right:7px solid transparent;
        border-top:10px solid #0D9488;
        margin-top:-1px;
      "></div>
    </div>
  `
}

// ─── 현재위치 커스텀 마커 HTML ───────────────────────────────
function myOverlayHtml() {
  return `
    <div style="
      display:flex;flex-direction:column;align-items:center;
      filter:drop-shadow(0 2px 4px rgba(37,99,235,0.4));
    ">
      <div style="
        background:#2563EB;color:#fff;
        font-size:11px;font-weight:700;font-family:'Pretendard Variable','맑은 고딕',sans-serif;
        padding:4px 9px;border-radius:20px;
        border:2px solid #fff;
      ">현재 위치</div>
      <div style="
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:8px solid #2563EB;
        margin-top:-1px;
      "></div>
    </div>
  `
}

export default function RouteMap({ destination }) {
  const mapDivRef  = useRef(null)
  const mapRef     = useRef(null)
  const overlayRef = useRef([]) // 정리용 오버레이 목록
  const [status, setStatus] = useState('loading') // loading | ready | error | nokey

  useEffect(() => {
    if (!mapDivRef.current) return
    if (!KAKAO_KEY) { setStatus('nokey'); return }

    let cancelled = false

    loadKakaoSDK()
      .then(() => {
        if (cancelled || !mapDivRef.current) return
        const { kakao } = window

        // ── 지도 초기화 ──────────────────────────────────────
        // 이미 map이 있으면 제거 후 재생성 (React StrictMode 대응)
        if (mapRef.current) {
          overlayRef.current.forEach(o => o.setMap(null))
          overlayRef.current = []
          mapRef.current = null
          mapDivRef.current.innerHTML = ''
        }

        const map = new kakao.maps.Map(mapDivRef.current, {
          center: new kakao.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
          level: 5,
        })
        mapRef.current = map

        // ── 목적지 검색 (Kakao Keyword Search) ──────────────
        const ps = new kakao.maps.services.Places()
        ps.keywordSearch(
          `서울 ${destination}`,
          (data, searchStatus) => {
            if (cancelled || !mapRef.current) return
            if (searchStatus !== kakao.maps.services.Status.OK || !data.length) {
              setStatus('error'); return
            }

            const place = data[0]
            const destLatLng = new kakao.maps.LatLng(
              parseFloat(place.y),
              parseFloat(place.x)
            )
            map.setCenter(destLatLng)
            map.setLevel(4)

            // 목적지 오버레이
            const destOverlay = new kakao.maps.CustomOverlay({
              position: destLatLng,
              content: destOverlayHtml(destination),
              yAnchor: 1.0,
            })
            destOverlay.setMap(map)
            overlayRef.current.push(destOverlay)

            setStatus('ready')

            // ── GPS 현재 위치 ─────────────────────────────
            navigator.geolocation?.getCurrentPosition(
              pos => {
                if (cancelled || !mapRef.current) return
                const { latitude: lat, longitude: lon } = pos.coords
                const inKorea = lat >= 33.0 && lat <= 38.7 && lon >= 124.5 && lon <= 131.0
                if (!inKorea) return

                const myLatLng = new kakao.maps.LatLng(lat, lon)
                const myOverlay = new kakao.maps.CustomOverlay({
                  position: myLatLng,
                  content: myOverlayHtml(),
                  yAnchor: 1.0,
                })
                myOverlay.setMap(map)
                overlayRef.current.push(myOverlay)

                // 현재 위치 + 목적지 모두 보이도록 범위 조정
                const bounds = new kakao.maps.LatLngBounds()
                bounds.extend(myLatLng)
                bounds.extend(destLatLng)
                map.setBounds(bounds, 60, 60, 60, 60)
              },
              () => {},
              { timeout: 5000 }
            )
          },
          { location: new kakao.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng), radius: 20000 }
        )
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      // 오버레이 정리 (지도 자체는 DOM 재사용을 위해 유지)
      overlayRef.current.forEach(o => { try { o.setMap(null) } catch {} })
      overlayRef.current = []
    }
  }, [destination])

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #F1F5F9',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* 헤더 */}
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0D9488', border: '2px solid #fff', boxShadow: '0 0 0 1px #0D9488' }} />
            <span style={{ fontSize: 11, color: '#64748B' }}>목적지</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', border: '2px solid #fff', boxShadow: '0 0 0 1px #2563EB' }} />
            <span style={{ fontSize: 11, color: '#64748B' }}>현재 위치</span>
          </span>
        </div>
      </div>

      {/* 지도 영역 */}
      <div style={{ position: 'relative' }}>
        <div ref={mapDivRef} style={{ height: 220 }} />

        {/* 로딩 오버레이 */}
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

        {/* 앱키 없음 안내 */}
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

        {/* 오류 안내 */}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, background: '#F8F9FA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>장소를 찾을 수 없어요</span>
          </div>
        )}
      </div>

      {/* 출처 */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid #F8FAFC' }}>
        <p style={{ fontSize: 11, color: '#CBD5E1', margin: 0 }}>지도 © Kakao</p>
      </div>
    </div>
  )
}
