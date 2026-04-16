import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { SearchIcon, MicIcon, ChevronRight, ClockIcon, AlertIcon,
         BuildingIcon, HospitalIcon, PillIcon, HomeIcon, WindIcon } from '../components/Icons.jsx'
import { getProfile, getHistory, saveProfile } from '../services/storage.js'
import { checkEmergency, parseUserQuery } from '../services/claude.js'
import { getAirQuality } from '../services/seoulApi.js'

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { 'User-Agent': 'SilverPassSeoulCare/1.0' } }
    )
    const data = await res.json()
    const raw = data.address?.city_district || data.address?.suburb || data.address?.quarter || ''
    return raw.replace(/서울특별시\s*/, '').trim() || null
  } catch { return null }
}

const HOUR = new Date().getHours()
const GREETING =
  HOUR < 5  ? '새벽에도 안전하게' :
  HOUR < 12 ? '좋은 아침이에요' :
  HOUR < 18 ? '안녕하세요' :
  HOUR < 22 ? '좋은 저녁이에요' : '밤에도 안전하게'

const FAV_CONFIG = {
  복지관: { Icon: BuildingIcon, bg: '#F5F3FF', iconColor: '#7C3AED', border: '#EDE9FE' },
  병원:   { Icon: HospitalIcon, bg: '#EFF6FF', iconColor: '#2563EB', border: '#DBEAFE' },
  약국:   { Icon: PillIcon,     bg: '#ECFDF5', iconColor: '#059669', border: '#D1FAE5' },
  집:     { Icon: HomeIcon,     bg: '#FFFBEB', iconColor: '#D97706', border: '#FDE68A' },
}
const DEFAULT_FAV = { Icon: MapPinIcon, bg: '#F0FDFA', iconColor: '#0D9488', border: '#CCFBF1' }
function MapPinIcon(p) {
  return <svg width={p.size||22} height={p.size||22} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
}

const BURDEN_BADGE = {
  low:    { bg: '#ECFDF5', text: '#065F46', label: '쉬움' },
  medium: { bg: '#FFFBEB', text: '#92400E', label: '보통' },
  high:   { bg: '#FEF2F2', text: '#991B1B', label: '힘듦' },
}

export default function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [profile, setProfile] = useState(getProfile())
  const [history, setHistory] = useState(getHistory())
  const [airNow, setAirNow] = useState(null)
  const [locating, setLocating] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const p = getProfile()
    setProfile(p)
    setHistory(getHistory())
    getAirQuality(p.district || '종로구').then(setAirNow)
  }, [])

  async function detectLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        // 한국 범위 밖이면 무시 (해외에서 테스트 시 이상한 구 이름 저장 방지)
        const inKorea = lat >= 33.0 && lat <= 38.7 && lon >= 124.5 && lon <= 131.0
        if (!inKorea) { setLocating(false); return }

        const district = await reverseGeocode(lat, lon)
        if (district) {
          const updated = { ...getProfile(), district }
          saveProfile(updated)
          setProfile(updated)
          getAirQuality(district).then(setAirNow)
        }
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  async function handleSearch(q) {
    const text = (q || query).trim()
    if (!text) return
    if (checkEmergency(text)) { navigate('/emergency', { state: { trigger: text } }); return }
    setLoading(true)
    try {
      const parsed = await parseUserQuery(text, profile)
      navigate('/route', { state: { query: text, parsed } })
    } finally { setLoading(false) }
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('음성 입력을 지원하지 않는 브라우저예요.'); return }
    if (recognitionRef.current) recognitionRef.current.stop()
    const rec = new SR()
    rec.lang = 'ko-KR'; rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onresult = e => { const t = e.results[0][0].transcript; setQuery(t); handleSearch(t) }
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec; rec.start()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', paddingBottom: 80 }}>

      {/* ── 상단 헤더 ── */}
      <div style={{ background: '#fff', padding: '52px 20px 20px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, margin: '0 0 4px', letterSpacing: '0.02em' }}>
              {GREETING}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.25 }}>
              {profile.name ? `${profile.name}님,` : '실버패스 서울 Care'}
              <br />
              <span style={{ color: '#0D9488' }}>어디 가실 건가요?</span>
            </h1>
          </div>
          {/* 위치 감지 버튼 */}
          <button onClick={detectLocation} disabled={locating} style={{
            flexShrink: 0, marginTop: 4,
            background: locating ? '#F0FDFA' : '#fff',
            border: '1.5px solid #CCFBF1',
            borderRadius: 12, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={locating ? '#0D9488' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <path d="m4.22 4.22 2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: locating ? '#0D9488' : '#64748B' }}>
              {locating ? '감지 중…' : profile.district || '위치'}
            </span>
          </button>
        </div>

        {/* 실시간 대기질 배너 */}
        {airNow && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: airNow.airAlert ? '#FEF2F2' : '#F0FDFA',
            border: `1px solid ${airNow.airAlert ? '#FECACA' : '#CCFBF1'}`,
            borderRadius: 10, padding: '8px 12px', marginTop: 4,
          }}>
            <WindIcon size={14} color={airNow.airAlert ? '#DC2626' : '#0D9488'} />
            <span style={{ fontSize: 13, fontWeight: 600, color: airNow.airAlert ? '#DC2626' : '#0D9488' }}>
              {profile.district || '서울'} 대기질 {airNow.grade}
            </span>
            <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>
              PM10 {airNow.pm10}㎍/㎥ · 실시간
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── 검색 바 ── */}
        <div>
          <div style={{
            background: '#fff', borderRadius: 16, border: '1.5px solid #E2E8F0',
            display: 'flex', alignItems: 'center', padding: '4px 4px 4px 16px', gap: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <SearchIcon size={18} color="#94A3B8" />
            <input
              type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="어디 가실 건가요? 말씀해 주세요"
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 16,
                background: 'transparent', color: '#0F172A', padding: '10px 0',
              }}
            />
            <button
              onClick={startVoice}
              style={{
                width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: listening ? '#FEE2E2' : '#F0FDFA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              <MicIcon size={20} color={listening ? '#DC2626' : '#0D9488'} />
            </button>
          </div>

          {listening && (
            <p style={{ textAlign: 'center', color: '#DC2626', fontWeight: 700, fontSize: 13, marginTop: 8 }}>
              듣고 있어요 — 말씀해 주세요
            </p>
          )}

          {query && (
            <button onClick={() => handleSearch()} disabled={loading} style={{
              width: '100%', marginTop: 10, padding: '15px 0',
              background: 'linear-gradient(135deg, #0F766E, #0D9488)',
              color: '#fff', fontWeight: 800, fontSize: 16,
              border: 'none', borderRadius: 14, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(13,148,136,0.3)', opacity: loading ? 0.7 : 1,
            }}>
              {loading ? '경로 찾는 중…' : '길 안내 받기 →'}
            </button>
          )}
        </div>

        {/* ── 프로필 미설정 안내 ── */}
        {!profile.name && (
          <button onClick={() => navigate('/profile')} style={{
            background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', width: '100%', textAlign: 'left',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: '#F0FDFA',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#0F172A', fontSize: 14, margin: 0 }}>프로필을 먼저 설정해 주세요</p>
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '3px 0 0' }}>이름 · 보호자 전화번호 · 이동 조건</p>
            </div>
            <ChevronRight size={16} color="#CBD5E1" />
          </button>
        )}

        {/* ── 자주 가는 곳 ── */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 12, letterSpacing: '0.02em' }}>
            자주 가는 곳
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {profile.favorites.map(fav => {
              const cfg = FAV_CONFIG[fav.name] || DEFAULT_FAV
              const { Icon } = cfg
              return (
                <button
                  key={fav.id} onClick={() => handleSearch(fav.name)} disabled={loading}
                  style={{
                    background: '#fff', border: `1.5px solid ${cfg.border}`,
                    borderRadius: 16, padding: '20px 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
                    cursor: 'pointer', textAlign: 'left', minHeight: 120,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform='scale(0.97)'; e.currentTarget.style.boxShadow='0 1px 2px rgba(0,0,0,0.04)' }}
                  onMouseUp={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)' }}
                  onTouchStart={e => { e.currentTarget.style.transform='scale(0.97)' }}
                  onTouchEnd={e => { e.currentTarget.style.transform='scale(1)' }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: cfg.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={22} color={cfg.iconColor} />
                  </div>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <p style={{ fontWeight: 800, fontSize: 17, color: '#0F172A', margin: 0 }}>{fav.name}</p>
                    {fav.address
                      ? <p style={{ color: '#64748B', fontSize: 13, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.address}</p>
                      : <p style={{ color: '#CBD5E1', fontSize: 13, margin: '3px 0 0' }}>탭하면 길 안내 시작</p>
                    }
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 최근 이동 ── */}
        {history.length > 0 && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 12, letterSpacing: '0.02em' }}>최근 이동</p>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {history.slice(0, 4).map((h, i) => {
                const b = BURDEN_BADGE[h.burden] || BURDEN_BADGE.low
                return (
                  <button key={i} onClick={() => handleSearch(h.destination)} disabled={loading}
                    style={{
                      width: '100%', border: 'none', background: 'transparent',
                      display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12,
                      cursor: 'pointer', textAlign: 'left',
                      borderBottom: i < Math.min(history.length, 4) - 1 ? '1px solid #F8FAFC' : 'none',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClockIcon size={16} color="#94A3B8" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.destination}</p>
                      <p style={{ color: '#94A3B8', fontSize: 13, margin: '2px 0 0' }}>
                        {new Date(h.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {h.burden && (
                      <span style={{ background: b.bg, color: b.text, fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>{b.label}</span>
                    )}
                    <ChevronRight size={14} color="#E2E8F0" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 응급 버튼 ── */}
        <button onClick={() => navigate('/emergency')} style={{
          width: '100%', border: '1.5px solid #FECACA', borderRadius: 16,
          background: '#fff', padding: '18px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          cursor: 'pointer',
        }}>
          <AlertIcon size={22} color="#DC2626" />
          <span style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>응급 상황</span>
        </button>

        {/* ── 빅데이터 활용 현황 ── */}
        <div style={{ background: '#F8F9FA', borderRadius: 16, padding: '18px', border: '1.5px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', margin: 0 }}>활용 공공 빅데이터</p>
            <span style={{ background: '#ECFDF5', color: '#059669', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>실시간 연동</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { source: '서울 열린데이터광장', items: ['실시간 대기환경(PM10/PM2.5)', '지하철 승강기 가동현황', '공중화장실 위치정보', '무더위쉼터 현황'], color: '#0D9488', bg: '#F0FDFA' },
              { source: '공공데이터포털', items: ['약국 현황 조회', '응급의료기관 목록'], color: '#2563EB', bg: '#EFF6FF' },
              { source: 'Claude AI (Anthropic)', items: ['개인 맞춤형 경로 설명 생성'], color: '#7C3AED', bg: '#F5F3FF' },
            ].map(({ source, items, color, bg }) => (
              <div key={source} style={{ background: bg, borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color, margin: '0 0 6px' }}>{source}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {items.map(item => (
                    <span key={item} style={{ background: '#fff', color: '#374151', fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 20 }}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '12px 0 0', textAlign: 'center' }}>
            서울시 고령자 168만 명을 위한 실시간 안전 이동 서비스
          </p>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
