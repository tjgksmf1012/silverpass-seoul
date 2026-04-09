import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { SearchIcon, MicIcon, ChevronRight, ClockIcon, AlertIcon,
         BuildingIcon, HospitalIcon, PillIcon, HomeIcon } from '../components/Icons.jsx'
import { getProfile, getHistory } from '../services/storage.js'
import { checkEmergency, parseUserQuery } from '../services/claude.js'

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
  const recognitionRef = useRef(null)

  useEffect(() => { setProfile(getProfile()); setHistory(getHistory()) }, [])

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
      <div style={{ background: '#fff', padding: '56px 20px 24px', borderBottom: '1px solid #F1F5F9' }}>
        <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, margin: '0 0 6px', letterSpacing: '0.02em' }}>
          {GREETING}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
          {profile.name ? `${profile.name}님,` : '실버패스 서울 Care'}
          <br />
          <span style={{ color: '#0D9488' }}>어디 가실 건가요?</span>
        </h1>
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
          <p style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 12, letterSpacing: '0.02em' }}>
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
                      ? <p style={{ color: '#94A3B8', fontSize: 11, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.address}</p>
                      : <p style={{ color: '#CBD5E1', fontSize: 11, margin: '3px 0 0' }}>주소 미설정</p>
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
            <p style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 12, letterSpacing: '0.02em' }}>최근 이동</p>
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
                      <p style={{ color: '#94A3B8', fontSize: 12, margin: '2px 0 0' }}>
                        {new Date(h.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {h.burden && (
                      <span style={{ background: b.bg, color: b.text, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>{b.label}</span>
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

      </div>
      <BottomNav />
    </div>
  )
}
