import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { SearchIcon, MicIcon, ChevronRight, ClockIcon,
         BuildingIcon, HospitalIcon, PillIcon, HomeIcon, WindIcon, MapPin } from '../components/Icons.jsx'
import { getProfile, getHistory, saveProfile } from '../services/storage.js'
import { checkEmergency } from '../services/claude.js'
import { searchPlaces } from '../services/kakaoSearch.js'
import { getAirQuality } from '../services/seoulApi.js'
import { getCurrentUser, getElderInfo } from '../services/auth.js'

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { 'User-Agent': 'SilverPassSeoulCare/1.0' } }
    )
    const data = await res.json()
    const addr = [
      data.address?.city || data.address?.state,
      data.address?.city_district || data.address?.suburb,
      data.address?.road,
    ].filter(Boolean).join(' ')
    return addr || null
  } catch { return null }
}

function extractDistrict(address) {
  if (!address) return '종로구'
  const match = address.match(/(\S+구)/)
  return match ? match[1] : '종로구'
}

const HOUR = new Date().getHours()
const GREETING =
  HOUR < 5  ? '새벽에도 안전하게' :
  HOUR < 12 ? '좋은 아침이에요' :
  HOUR < 18 ? '안녕하세요' :
  HOUR < 22 ? '좋은 저녁이에요' : '밤에도 안전하게'

const FAV_CONFIG = {
  복지관: { Icon: BuildingIcon, grad: 'linear-gradient(135deg,#A78BFA,#7C3AED)', shadow: 'rgba(124,58,237,0.35)' },
  병원:   { Icon: HospitalIcon, grad: 'linear-gradient(135deg,#60A5FA,#2563EB)', shadow: 'rgba(37,99,235,0.35)'  },
  약국:   { Icon: PillIcon,     grad: 'linear-gradient(135deg,#34D399,#059669)', shadow: 'rgba(5,150,105,0.35)'  },
  집:     { Icon: HomeIcon,     grad: 'linear-gradient(135deg,#FCD34D,#D97706)', shadow: 'rgba(217,119,6,0.35)'  },
}
const DEFAULT_FAV = { Icon: MapPin, grad: 'linear-gradient(135deg,#5EEAD4,#0D9488)', shadow: 'rgba(13,148,136,0.35)' }

const BURDEN_BADGE = {
  low:    { bg: '#ECFDF5', text: '#065F46', label: '쉬움' },
  medium: { bg: '#FFFBEB', text: '#92400E', label: '보통' },
  high:   { bg: '#FEF2F2', text: '#991B1B', label: '힘듦' },
}

export default function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [pendingSearch, setPendingSearch] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [profile, setProfile] = useState(getProfile())
  const [history, setHistory] = useState(getHistory())
  const [airNow, setAirNow] = useState(null)
  const [locating, setLocating] = useState(false)
  const [elderQuickDests, setElderQuickDests] = useState([])
  const recognitionRef = useRef(null)

  useEffect(() => {
    const p = getProfile()
    setProfile(p)
    setHistory(getHistory())
    getAirQuality(extractDistrict(p.homeAddress) || p.district || '종로구').then(setAirNow)

    const user = getCurrentUser()
    if (user) {
      getElderInfo(user.id).then(info => {
        if (!info) return
        const dests = []
        if (info.home_address) dests.push({ label: '🏠 집으로', dest: info.home_address })
        if (info.frequent_places) {
          try {
            const favs = JSON.parse(info.frequent_places)
            if (Array.isArray(favs)) {
              const icons = { 복지관: '🏛️', 병원: '🏥', 약국: '💊', 집: '🏠' }
              favs.filter(f => f.address).forEach(f => {
                dests.push({ label: `${icons[f.name] || '📍'} ${f.name}`, dest: f.address })
              })
            }
          } catch {
            info.frequent_places.split(',').map(s => s.trim()).filter(Boolean).forEach(place => {
              dests.push({ label: `📍 ${place}`, dest: place })
            })
          }
        }
        setElderQuickDests(dests)
      })
    }
  }, [])

  async function detectLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        const inKorea = lat >= 33.0 && lat <= 38.7 && lon >= 124.5 && lon <= 131.0
        if (!inKorea) { setLocating(false); return }
        const address = await reverseGeocode(lat, lon)
        if (address) {
          const updated = { ...getProfile(), homeAddress: address, district: extractDistrict(address) }
          saveProfile(updated)
          setProfile(updated)
          getAirQuality(extractDistrict(address)).then(setAirNow)
        }
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  function goRoute(dest, parsed = null) {
    setSuggestions([])
    setQuery('')
    navigate('/route', { state: { query: dest, parsed: parsed || { destination: dest } } })
  }

  async function handleSearch(q) {
    const text = (q || query).trim()
    if (!text) return
    if (checkEmergency(text)) { navigate('/emergency', { state: { trigger: text } }); return }
    setSuggestions([{ label: '검색 중…', address: null, isLoading: true }])
    try {
      const results = await searchPlaces(text)
      setSuggestions([
        ...results.map(p => ({ label: p.name, address: p.address, category: p.category, phone: p.phone, lat: p.lat, lng: p.lng })),
        { label: '주소 직접 검색하기', address: null, isDaum: true },
      ])
    } catch (err) {
      console.error('장소 검색 오류:', err)
      setSuggestions([
        { label: text, address: text, category: '직접 입력', isRaw: true },
        { label: '주소 직접 검색하기', address: null, isDaum: true },
      ])
    }
  }

  function openAddressSearch() {
    if (!window.daum?.Postcode) return
    new window.daum.Postcode({
      oncomplete(data) {
        const addr = data.roadAddress || data.jibunAddress
        setPendingSearch(null)
        goRoute(addr)
      },
    }).open()
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('음성 입력을 지원하지 않는 브라우저예요.'); return }
    if (recognitionRef.current) recognitionRef.current.stop()
    const rec = new SR()
    rec.lang = 'ko-KR'; rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend   = () => setListening(false)
    rec.onresult = e => { const t = e.results[0][0].transcript; setQuery(t); handleSearch(t) }
    rec.onerror  = () => setListening(false)
    recognitionRef.current = rec; rec.start()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', paddingBottom: 80 }}>

      {/* ── 그라디언트 헤더 ── */}
      <div style={{
        background: 'linear-gradient(165deg, #064E3B 0%, #0F766E 50%, #0D9488 100%)',
        padding: '52px 18px 24px',
      }}>
        {/* 인사말 + 위치 칩 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 600, margin: 0 }}>{GREETING}</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '5px 0 0', lineHeight: 1.25 }}>
              {profile.name ? `${profile.name}님,` : '실버패스 서울'}
              <br />
              <span style={{ color: '#6EE7B7' }}>어디 가실 건가요?</span>
            </h1>
          </div>

          <button onClick={detectLocation} disabled={locating} style={{
            background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 20, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 5,
            cursor: 'pointer', flexShrink: 0, marginTop: 4,
          }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              {locating ? '감지 중…' : (profile.homeAddress ? extractDistrict(profile.homeAddress) : '위치 설정')}
            </span>
          </button>
        </div>

        {/* 대기질 뱃지 */}
        {airNow && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: airNow.airAlert ? 'rgba(220,38,38,0.22)' : 'rgba(255,255,255,0.14)',
            border: `1px solid ${airNow.airAlert ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.22)'}`,
            borderRadius: 20, padding: '5px 12px', marginBottom: 16,
          }}>
            <WindIcon size={12} color={airNow.airAlert ? '#FCA5A5' : 'rgba(255,255,255,0.85)'} />
            <span style={{ fontSize: 12, fontWeight: 700, color: airNow.airAlert ? '#FCA5A5' : 'rgba(255,255,255,0.85)' }}>
              대기질 {airNow.grade} · PM10 {airNow.pm10}㎍/㎥
            </span>
          </div>
        )}

        {/* 검색 바 */}
        <div style={{ position: 'relative' }}>
          <div style={{
            background: '#fff', borderRadius: suggestions.length ? '16px 16px 0 0' : 16,
            display: 'flex', alignItems: 'center', padding: '4px 4px 4px 16px', gap: 8,
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
          }}>
            <SearchIcon size={18} color="#94A3B8" />
            <input
              type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="목적지를 입력하거나 말씀해 주세요"
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 15,
                background: 'transparent', color: '#0F172A', padding: '13px 0',
                fontFamily: 'inherit',
              }}
            />
            <button onClick={startVoice} style={{
              width: 46, height: 46, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: listening ? '#FEE2E2' : '#F0FDFA',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <MicIcon size={20} color={listening ? '#DC2626' : '#0D9488'} />
            </button>
          </div>

          {/* 검색 결과 드롭다운 */}
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', borderRadius: '0 0 16px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden',
            }}>
              {suggestions.map((s, i) => (
                <button key={i}
                  onClick={() => {
                    if (s.isDaum) return openAddressSearch()
                    if (s.isLoading) return null
                    const destination = s.isRaw ? (s.address || s.label) : s.label
                    return goRoute(destination, { destination, address: s.address, lat: s.lat, lng: s.lng })
                  }}
                  style={{
                    width: '100%', border: 'none',
                    background: s.isDaum ? '#F8FAFC' : '#fff',
                    padding: '12px 16px', textAlign: 'left',
                    cursor: s.isLoading ? 'default' : 'pointer', fontFamily: 'inherit',
                    borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {s.isLoading ? '⏳' : s.isDaum ? '🔍' : '📍'}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: s.isDaum ? '#64748B' : '#0F172A', margin: 0 }}>{s.label}</p>
                      {s.category && <span style={{ fontSize: 11, color: '#0D9488', background: '#F0FDFA', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{s.category}</span>}
                    </div>
                    {s.address && <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</p>}
                    {s.phone && <p style={{ fontSize: 12, color: '#64748B', margin: '1px 0 0' }}>{s.phone}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {listening && (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 13, margin: '10px 0 0' }}>
            🎤 듣고 있어요 — 말씀해 주세요
          </p>
        )}
      </div>

      {/* ── 바디 ── */}
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 길안내 버튼 (입력 시) */}
        {query && (
          <button onClick={() => handleSearch()} style={{
            width: '100%', padding: '16px 0',
            background: 'linear-gradient(135deg, #0F766E, #0D9488)',
            color: '#fff', fontWeight: 800, fontSize: 16,
            border: 'none', borderRadius: 14, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(13,148,136,0.35)',
          }}>
            {`"${query}" 길 안내 받기 →`}
          </button>
        )}

        {/* 보호자 등록 빠른 목적지 */}
        {(() => {
          const favDests = (profile.favorites || [])
            .filter(f => f.address)
            .map(f => ({ label: `${f.icon || '📍'} ${f.name}`, dest: f.address }))
          const allDests = [...elderQuickDests, ...favDests]
          if (!allDests.length) return null
          return (
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '0 0 8px', letterSpacing: '0.03em' }}>바로 출발</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {allDests.map((d, i) => (
                  <button key={i} onClick={() => goRoute(d.dest)}                    style={{
                      background: '#fff', border: '1.5px solid #CCFBF1',
                      borderRadius: 20, padding: '10px 16px',
                      fontSize: 14, fontWeight: 700, color: '#0F766E',
                      cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      transition: 'transform 0.12s',
                    }}
                    onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.95)' }}
                    onTouchEnd={e   => { e.currentTarget.style.transform = 'scale(1)' }}
                    onMouseDown={e  => { e.currentTarget.style.transform = 'scale(0.95)' }}
                    onMouseUp={e    => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* 프로필 미설정 안내 */}
        {!profile.name && (
          <button onClick={() => navigate('/profile')} style={{
            background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14,
            padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', width: '100%', textAlign: 'left',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#0F172A', fontSize: 14, margin: 0 }}>프로필을 먼저 설정해 주세요</p>
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '2px 0 0' }}>이름 · 보호자 연락처 · 이동 조건</p>
            </div>
            <ChevronRight size={16} color="#CBD5E1" />
          </button>
        )}

        {/* 자주 가는 곳 */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '0 0 10px', letterSpacing: '0.03em' }}>자주 가는 곳</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {profile.favorites.map(fav => {
              const cfg = FAV_CONFIG[fav.name] || DEFAULT_FAV
              const { Icon } = cfg
              return (
                <button
                  key={fav.id} onClick={() => fav.address ? goRoute(fav.address) : navigate('/profile')}
                  style={{
                    flex: 1, border: 'none', background: '#fff',
                    borderRadius: 18, padding: '16px 6px 14px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
                    transition: 'transform 0.12s',
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.91)' }}
                  onTouchEnd={e   => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseDown={e  => { e.currentTarget.style.transform = 'scale(0.91)' }}
                  onMouseUp={e    => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: cfg.grad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 6px 14px ${cfg.shadow}`,
                  }}>
                    <Icon size={24} color="#fff" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.01em' }}>{fav.name}</span>
                  {fav.address && (
                    <span style={{ fontSize: 10, color: '#94A3B8', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: -4 }}>
                      {fav.address}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 최근 이동 */}
        {history.length > 0 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '0 0 10px', letterSpacing: '0.03em' }}>최근 이동</p>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {history.slice(0, 3).map((h, i) => {
                const b = BURDEN_BADGE[h.burden] || BURDEN_BADGE.low
                return (
                  <button key={i} onClick={() => goRoute(h.destination)}                    style={{
                      width: '100%', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12,
                      cursor: 'pointer', textAlign: 'left',
                      borderBottom: i < Math.min(history.length, 3) - 1 ? '1px solid #F8FAFC' : 'none',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClockIcon size={14} color="#94A3B8" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.destination}</p>
                      <p style={{ color: '#94A3B8', fontSize: 12, margin: '1px 0 0' }}>
                        {new Date(h.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {h.burden && (
                      <span style={{ background: b.bg, color: b.text, fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>{b.label}</span>
                    )}
                    <ChevronRight size={14} color="#E2E8F0" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>

      <BottomNav />

      {/* 목적지 확인 바텀시트 */}
      {pendingSearch && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div onClick={() => setPendingSearch(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px 18px 32px', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E2E8F0', margin: '0 auto 16px' }} />

            {/* 목적지 표시 */}
            <div style={{ background: '#F0FDFA', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#0D9488', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>목적지</p>
              {(() => {
                const GENERIC = ['목적지', '목적지명', '알 수 없음', '']
                const dest = pendingSearch.parsed?.destination
                const display = (!dest || GENERIC.includes(dest)) ? pendingSearch.query : dest
                return (
                  <>
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>{display}</p>
                    {display !== pendingSearch.query && (
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>검색어: "{pendingSearch.query}"</p>
                    )}
                  </>
                )
              })()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { goRoute(pendingSearch.parsed?.destination || pendingSearch.query, pendingSearch.parsed); setPendingSearch(null); setQuery('') }}
                style={{ width: '100%', border: 'none', borderRadius: 12, padding: '15px 0', background: 'linear-gradient(135deg, #0F766E, #0D9488)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                맞아요, 안내해 주세요 →
              </button>
              <button
                onClick={openAddressSearch}
                style={{ width: '100%', border: '1.5px solid #CBD5E1', borderRadius: 12, padding: '13px 0', background: '#F8FAFC', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                🔍 주소 직접 검색하기
              </button>
              <button
                onClick={() => setPendingSearch(null)}
                style={{ width: '100%', border: 'none', background: 'none', color: '#94A3B8', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
