import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { SearchIcon, MicIcon, ChevronRight, ClockIcon,
         BuildingIcon, HospitalIcon, PillIcon, HomeIcon, WindIcon, MapPin } from '../components/Icons.jsx'
import { getProfile, getHistory, saveProfile, normalizeFavorites } from '../services/storage.js'
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
        const updated = { ...getProfile() }
        if (info.home_address) {
          updated.homeAddress = info.home_address
          updated.district = extractDistrict(info.home_address)
        }
        if (info.district && !info.home_address) updated.district = info.district
        if (info.max_walk_min) updated.maxWalkMin = info.max_walk_min
        if (info.allow_stairs != null) updated.allowStairs = info.allow_stairs
        if (info.mobility_aid != null) updated.mobilityAid = info.mobility_aid
        if (info.phone) updated.guardianPhone = info.phone
        if (info.frequent_places) {
          try {
            const favs = JSON.parse(info.frequent_places)
            if (Array.isArray(favs)) updated.favorites = normalizeFavorites(favs)
          } catch {
            updated.favorites = normalizeFavorites(info.frequent_places
              .split(',')
              .map(place => ({ id: `remote_${place}`, name: place.trim(), icon: '📍', address: place.trim(), showOnHome: true, custom: true }))
              .filter(place => place.name))
          }
        }
        saveProfile(updated)
        setProfile(updated)
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

  const visibleFavorites = (profile.favorites || []).filter(f => f.showOnHome !== false)

  return (
    <div className="senior-page">

      {/* ── 그라디언트 헤더 ── */}
      <div style={{
        background: 'linear-gradient(165deg, #064E3B 0%, #0F766E 52%, #0D9488 100%)',
        padding: '56px 20px 28px',
      }}>
        {/* 인사말 + 위치 칩 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', fontWeight: 700, margin: 0 }}>{GREETING}</p>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: '6px 0 0', lineHeight: 1.18 }}>
              {profile.name ? `${profile.name}님,` : '실버패스 서울'}
              <br />
              <span style={{ color: '#A7F3D0' }}>어디 가실 건가요?</span>
            </h1>
          </div>

          <button onClick={detectLocation} disabled={locating} style={{
            background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 18, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 5,
            cursor: 'pointer', flexShrink: 0, marginTop: 4, minHeight: 48,
          }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.95)' }}>
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
            borderRadius: 20, padding: '8px 13px', marginBottom: 18,
          }}>
            <WindIcon size={16} color={airNow.airAlert ? '#FCA5A5' : 'rgba(255,255,255,0.9)'} />
            <span style={{ fontSize: 14, fontWeight: 800, color: airNow.airAlert ? '#FCA5A5' : 'rgba(255,255,255,0.92)' }}>
              대기질 {airNow.grade} · PM10 {airNow.pm10}㎍/㎥
            </span>
          </div>
        )}

        {/* 검색 바 */}
        <div style={{ position: 'relative' }}>
          <div style={{
            background: '#fff', borderRadius: suggestions.length ? '20px 20px 0 0' : 20,
            display: 'flex', alignItems: 'center', padding: '6px 6px 6px 18px', gap: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          }}>
            <SearchIcon size={22} color="#64748B" stroke={2} />
            <input
              type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="목적지를 입력하거나 말씀해 주세요"
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 19,
                background: 'transparent', color: '#0F172A', padding: '17px 0',
                fontFamily: 'inherit',
              }}
            />
            <button onClick={startVoice} style={{
              width: 58, height: 58, borderRadius: 16, border: 'none', cursor: 'pointer',
              background: listening ? '#FEE2E2' : '#F0FDFA',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <MicIcon size={26} color={listening ? '#DC2626' : '#0D9488'} stroke={2.2} />
            </button>
          </div>

          {/* 검색 결과 드롭다운 */}
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', borderRadius: '0 0 20px 20px',
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
                    padding: '16px 18px', textAlign: 'left',
                    cursor: s.isLoading ? 'default' : 'pointer', fontFamily: 'inherit',
                    borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>
                    {s.isLoading ? '⏳' : s.isDaum ? '🔍' : '📍'}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 800, fontSize: 17, color: s.isDaum ? '#475569' : '#0F172A', margin: 0 }}>{s.label}</p>
                      {s.category && <span style={{ fontSize: 12, color: '#0D9488', background: '#F0FDFA', padding: '3px 8px', borderRadius: 10, fontWeight: 800 }}>{s.category}</span>}
                    </div>
                    {s.address && <p style={{ fontSize: 14, color: '#64748B', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</p>}
                    {s.phone && <p style={{ fontSize: 14, color: '#475569', margin: '2px 0 0' }}>{s.phone}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {listening && (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: 16, margin: '12px 0 0' }}>
            마이크 듣는 중이에요. 말씀해 주세요
          </p>
        )}
      </div>

      {/* ── 바디 ── */}
      <div style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* 길안내 버튼 (입력 시) */}
        {query && (
          <button onClick={() => handleSearch()} style={{
            width: '100%', padding: '18px 0',
            background: 'linear-gradient(135deg, #0F766E, #0D9488)',
            color: '#fff', fontWeight: 900, fontSize: 18,
            border: 'none', borderRadius: 18, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(13,148,136,0.35)',
          }}>
            {`"${query}" 길 안내 받기 →`}
          </button>
        )}

        {/* 보호자 등록 빠른 목적지 */}
        {(() => {
          const favDests = visibleFavorites
            .filter(f => f.address)
            .map(f => ({ label: `${f.icon || '📍'} ${f.name}`, dest: f.address }))
          const homeDest = profile.homeAddress
            ? [{ label: '🏠 집으로', dest: profile.homeAddress }]
            : []
          const seen = new Set()
          const allDests = [...homeDest, ...favDests].filter(item => {
            const key = item.dest
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          if (!allDests.length) return null
          return (
            <div>
              <p className="senior-section-title">바로 출발</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {allDests.map((d, i) => (
                  <button key={i} onClick={() => goRoute(d.dest)}                    style={{
                      background: '#fff', border: '1.5px solid #CCFBF1',
                      borderRadius: 20, padding: '13px 18px',
                      fontSize: 16, fontWeight: 800, color: '#0F766E',
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
              {!visibleFavorites.some(f => f.address) && profile.homeAddress && (
                <p style={{ color: '#64748B', fontSize: 13, fontWeight: 600, margin: '8px 0 0' }}>
                  보호자가 자주 가는 곳을 등록하면 여기에 함께 보여요
                </p>
              )}
            </div>
          )
        })()}

        {/* 프로필 미설정 안내 */}
        {!profile.name && (
          <button onClick={() => navigate('/profile')} style={{
            background: '#fff', border: '1.5px solid #BFEFE6', borderRadius: 18,
            padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 14,
            cursor: 'pointer', width: '100%', textAlign: 'left',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 900, color: '#0F172A', fontSize: 17, margin: 0 }}>프로필을 먼저 설정해 주세요</p>
              <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0', fontWeight: 600 }}>보행 시간과 보호자 연락처를 저장해요</p>
            </div>
            <ChevronRight size={20} color="#94A3B8" />
          </button>
        )}

        {/* 자주 가는 곳 */}
        <div>
          <p className="senior-section-title">자주 가는 곳</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {visibleFavorites.map(fav => {
              const cfg = FAV_CONFIG[fav.name] || DEFAULT_FAV
              const { Icon } = cfg
              return (
                <button
                  key={fav.id} onClick={() => fav.address ? goRoute(fav.address) : navigate('/profile')}
                  style={{
                    border: 'none', background: '#fff',
                    borderRadius: 18, padding: '17px 10px 15px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
                    transition: 'transform 0.12s',
                    minHeight: 132,
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.91)' }}
                  onTouchEnd={e   => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseDown={e  => { e.currentTarget.style.transform = 'scale(0.91)' }}
                  onMouseUp={e    => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div style={{
                    width: 58, height: 58, borderRadius: 18,
                    background: cfg.grad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 6px 14px ${cfg.shadow}`,
                  }}>
                    <Icon size={28} color="#fff" stroke={2} />
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#1E293B', letterSpacing: 0 }}>{fav.name}</span>
                  {fav.address && (
                    <span style={{ fontSize: 12, color: '#64748B', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: -3, fontWeight: 600 }}>
                      {fav.address}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {!visibleFavorites.length && (
            <div style={{
              border: '1.5px dashed #BFEFE6', background: '#fff',
              borderRadius: 18, padding: '18px 14px', color: '#0F766E',
              fontSize: 16, fontWeight: 800, textAlign: 'center',
            }}>
              보호자가 등록하면 여기에 보여요
            </div>
          )}
        </div>

        {/* 최근 이동 */}
        {history.length > 0 && (
          <div>
            <p className="senior-section-title">최근 이동</p>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {history.slice(0, 3).map((h, i) => {
                const b = BURDEN_BADGE[h.burden] || BURDEN_BADGE.low
                return (
                  <button key={i} onClick={() => goRoute(h.destination)}                    style={{
                      width: '100%', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', padding: '16px 16px', gap: 13,
                      cursor: 'pointer', textAlign: 'left',
                      borderBottom: i < Math.min(history.length, 3) - 1 ? '1px solid #F8FAFC' : 'none',
                    }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClockIcon size={20} color="#64748B" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 900, fontSize: 17, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.destination}</p>
                      <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0', fontWeight: 600 }}>
                        {new Date(h.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {h.burden && (
                      <span style={{ background: b.bg, color: b.text, fontSize: 13, fontWeight: 900, padding: '5px 10px', borderRadius: 20, flexShrink: 0 }}>{b.label}</span>
                    )}
                    <ChevronRight size={18} color="#CBD5E1" />
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
