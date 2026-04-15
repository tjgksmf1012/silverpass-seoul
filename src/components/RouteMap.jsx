/**
 * RouteMap — Leaflet + OpenStreetMap 기반 경로 지도
 * API키 불필요, 완전 무료
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Vite에서 Leaflet 기본 아이콘 경로 오류 방지 (divIcon 사용하므로 불필요하지만 보험)
delete L.Icon.Default.prototype._getIconUrl

const SEOUL_CENTER = [37.5665, 126.9780]

/** Nominatim으로 서울 내 장소 좌표 검색 */
async function geocodeInSeoul(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent('서울 ' + query)}&format=json&countrycodes=kr&limit=1&accept-language=ko`,
      { headers: { 'User-Agent': 'SilverPassSeoulCare/1.0' } }
    )
    const data = await res.json()
    if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  } catch {}
  return null
}

/** 마커 div 아이콘 생성 헬퍼 */
function makeIcon(color, size = 16) {
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};border-radius:50%;
      border:3px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25)
    "></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/** 목적지 핀 (물방울 모양) */
function makeDestIcon() {
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;
      background:#0D9488;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid #fff;
      box-shadow:0 3px 10px rgba(13,148,136,0.4)
    "></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  })
}

export default function RouteMap({ destination, toilets = [], pharmacies = [] }) {
  const mapDivRef = useRef(null)
  const mapRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return

    const map = L.map(mapDivRef.current, {
      center: SEOUL_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false, // 모바일에서 실수 방지
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    let destCoords = null

    // 1. 목적지 지오코딩
    geocodeInSeoul(destination)
      .then(coords => {
        destCoords = coords || SEOUL_CENTER
        map.setView(destCoords, 15)

        L.marker(destCoords, { icon: makeDestIcon() })
          .addTo(map)
          .bindPopup(`<b style="font-size:14px">${destination}</b><br><span style="color:#64748B;font-size:12px">목적지</span>`)
          .openPopup()

        setStatus('ready')
      })
      .catch(() => setStatus('error'))

    // 2. 현재 위치 표시
    navigator.geolocation?.getCurrentPosition(
      pos => {
        if (!mapRef.current) return
        const { latitude: lat, longitude: lon } = pos.coords
        const myLatLng = [lat, lon]

        L.marker(myLatLng, { icon: makeIcon('#2563EB', 18) })
          .addTo(map)
          .bindPopup('<b style="font-size:13px">현재 위치</b>')

        // 현재 위치 ↔ 목적지 모두 보이도록 줌 조정
        if (destCoords) {
          const bounds = L.latLngBounds([myLatLng, destCoords])
          map.fitBounds(bounds, { padding: [40, 40] })
        }
      },
      () => {}, // 위치 거부 시 무시
      { timeout: 5000 }
    )

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [destination])

  return (
    <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* 헤더 */}
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
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
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #E2E8F0', borderTopColor: '#0D9488', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#94A3B8' }}>지도 불러오는 중…</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      {/* 출처 */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid #F8FAFC' }}>
        <p style={{ fontSize: 11, color: '#CBD5E1', margin: 0 }}>지도 데이터 © OpenStreetMap contributors</p>
      </div>
    </div>
  )
}
