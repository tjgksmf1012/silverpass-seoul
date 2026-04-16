import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getProfile, addHistory } from '../services/storage.js'
import { getRouteData } from '../services/seoulApi.js'
import { generateRouteExplanation, generateSubwayGuide } from '../services/claude.js'
import { ArrowLeft, BusIcon, ElevatorIcon, WindIcon, ToiletIcon,
         ShelterIcon, ShareIcon, AlertIcon, CheckCircle, PillIcon } from '../components/Icons.jsx'
import RouteMap from '../components/RouteMap.jsx'

const BURDEN = {
  low:    { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', accent: '#059669', label: '이동 쉬움', sub: '편하게 다녀오실 수 있어요' },
  medium: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', accent: '#D97706', label: '보통',     sub: '천천히 이동하시면 괜찮아요' },
  high:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', accent: '#DC2626', label: '힘들 수 있어요', sub: '보호자와 함께 이동하세요' },
}
const AIR_COLOR = { '좋음': '#059669', '보통': '#D97706', '나쁨': '#DC2626', '매우나쁨': '#7C2D12' }

export default function Route_() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [routeData, setRouteData] = useState(null)
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('bus')
  const [subwayGuide, setSubwayGuide] = useState(null)
  const profile = getProfile()
  const destination = state?.parsed?.destination || state?.query || '목적지'

  useEffect(() => {
    async function load() {
      try {
        const data = await getRouteData(destination, profile)
        setRouteData(data)
        addHistory({ destination, duration: data.duration, burden: data.burden })
        const exp = await generateRouteExplanation(data, profile)
        setExplanation(exp)
        const subway = await generateSubwayGuide(destination)
        setSubwayGuide(subway)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: '#F8F9FA', padding: '0 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#0D9488', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>{destination}</p>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#0D9488', margin: 0 }}>최적 경로를 분석하는 중이에요</p>
      </div>
      <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: '실시간 대기질 분석', color: '#059669' },
          { label: '승강기 가동 현황 확인', color: '#2563EB' },
          { label: '저상버스 도착 정보', color: '#7C3AED' },
          { label: '근처 약국 정보', color: '#D97706' },
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
  const airColor = AIR_COLOR[air?.grade] || '#64748B'

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', paddingBottom: 32 }}>

      {/* ── 헤더 ── */}
      <div style={{ background: '#fff', padding: '52px 16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={18} color="#0F172A" />
        </button>
        <div>
          <p style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, margin: 0 }}>목적지</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>{destination}</h1>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>예상 시간</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0D9488', margin: 0 }}>
            {routeData?.duration}<span style={{ fontSize: 14, fontWeight: 600 }}>분</span>
          </p>
          <p style={{ fontSize: 10, color: '#CBD5E1', margin: 0 }}>도보 추정</p>
        </div>
      </div>

      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── ① 부담도 카드 ── */}
        <div style={{ background: b.bg, border: `1.5px solid ${b.border}`, borderRadius: 20, padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <span style={{ background: '#fff', color: b.text, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: `1px solid ${b.border}` }}>이동 부담도</span>
              <p style={{ fontSize: 24, fontWeight: 800, color: b.text, margin: '10px 0 4px' }}>{b.label}</p>
              <p style={{ fontSize: 13, color: b.accent, margin: 0, fontWeight: 600 }}>{b.sub}</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', textAlign: 'center', border: `1px solid ${b.border}` }}>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 2px' }}>도보</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{routeData?.walkDistance}<span style={{ fontSize: 12 }}>m</span></p>
            </div>
          </div>
          {/* 상태 3종 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { Icon: BusIcon,      label: routeData?.lowFloorBus ? '저상버스 있음' : '저상버스 없음', ok: routeData?.lowFloorBus },
              { Icon: ElevatorIcon, label: routeData?.elevator ? '승강기 정상' : '승강기 점검', ok: routeData?.elevator },
              { Icon: WindIcon,     label: air?.grade || '보통', ok: !air?.airAlert },
            ].map(({ Icon, label, ok }, i) => (
              <div key={i} style={{ flex: 1, background: '#fff', border: `1px solid ${b.border}`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <Icon size={18} color={ok ? b.accent : '#DC2626'} />
                <p style={{ fontSize: 11, fontWeight: 600, color: ok ? '#374151' : '#DC2626', margin: '6px 0 0', lineHeight: 1.3 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ② 지도 ── */}
        <RouteMap
          destination={destination}
          toilets={routeData?.toilets}
          pharmacies={routeData?.pharmacies}
        />

        {/* ── ③ 경고 배너 ── */}
        {routeData?.weatherAlert && (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertIcon size={18} color="#D97706" />
            <p style={{ color: '#92400E', fontWeight: 600, fontSize: 14, margin: 0 }}>{routeData.weatherAlert}</p>
          </div>
        )}

        {/* ── ③ 이동수단 탭 ── */}
        <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {/* 탭 헤더 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9' }}>
            {[
              { id: 'bus',    label: '🚌 버스' },
              { id: 'subway', label: '🚇 지하철' },
              { id: 'taxi',   label: '🚕 택시' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '13px 4px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: activeTab === tab.id ? 800 : 600,
                color: activeTab === tab.id ? '#0D9488' : '#94A3B8',
                borderBottom: activeTab === tab.id ? '2.5px solid #0D9488' : '2.5px solid transparent',
                transition: 'all 0.15s',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 버스 패널 */}
          {activeTab === 'bus' && (
            <div>
              {routeData?.buses?.length > 0 ? (
                <>
                  <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>실시간 버스 도착 정보</span>
                    <span style={{ marginLeft: 'auto', background: '#F8F9FA', color: '#94A3B8', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>예시</span>
                  </div>
                  {routeData.buses.map((bus, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderTop: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ background: bus.isLowFloor ? '#0D9488' : '#374151', color: '#fff', fontWeight: 800, fontSize: 14, padding: '6px 12px', borderRadius: 10, minWidth: 52, textAlign: 'center' }}>{bus.busNo}</span>
                      {bus.isLowFloor && <span style={{ background: '#F0FDFA', color: '#0D9488', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>저상 ♿</span>}
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', margin: 0 }}>{bus.arrmsg1}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>다음 버스</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #F8FAFC', background: '#F8F9FA' }}>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>💡 초록색 버스는 저상버스(휠체어·유모차 이용 가능)예요</p>
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>버스 정보를 불러오는 중이에요</div>
              )}
            </div>
          )}

          {/* 지하철 패널 */}
          {activeTab === 'subway' && (
            <div>
              {subwayGuide ? (
                <>
                  {/* 호선 배지 + 역명 */}
                  <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16,
                      background: subwayGuide.lineColor,
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
                    <div style={{ marginLeft: 'auto', textAlign: 'right', background: subwayGuide.lineColor + '15', borderRadius: 12, padding: '8px 12px', border: `1px solid ${subwayGuide.lineColor}30` }}>
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 2px', fontWeight: 600 }}>방향</p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: subwayGuide.lineColor, margin: 0 }}>{subwayGuide.direction}</p>
                    </div>
                  </div>

                  {/* 안내 항목들 */}
                  <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { icon: '🚪', label: '탑승역', value: subwayGuide.nearestStation.replace('역','') + '역 승차' },
                      { icon: '🧭', label: '탑승 방향', value: subwayGuide.direction + ' 방향 탑승' },
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

                  {/* 어르신 팁 */}
                  {subwayGuide.tip && (
                    <div style={{ margin: '0 16px 14px', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
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

          {/* 택시 패널 */}
          {activeTab === 'taxi' && (
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 복지콜 */}
              <a href="tel:1588-4388" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#F0FDFA', border: '1.5px solid #CCFBF1', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
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

              {/* 카카오택시 */}
              <a href="kakaomap://taxi" style={{ textDecoration: 'none' }} onError={e => e.preventDefault()}>
                <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FEE500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 24 }}>🚕</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>카카오택시</p>
                    <p style={{ fontSize: 12, color: '#92400E', margin: '3px 0 0' }}>앱에서 바로 호출하세요</p>
                  </div>
                  <div style={{ background: '#FEE500', borderRadius: 10, padding: '6px 12px' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#000' }}>열기</span>
                  </div>
                </div>
              </a>

              {/* 일반 택시 안내 */}
              <div style={{ background: '#F8F9FA', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 6px' }}>택시 기본 정보</p>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>기본요금</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '2px 0 0' }}>4,800원</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>심야할증</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '2px 0 0' }}>오후 10시~</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>어르신 할인</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#0D9488', margin: '2px 0 0' }}>복지콜 적용</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── ④ 대기질 ── */}
        {air && (
          <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <WindIcon size={16} color="#0F172A" />
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>대기질</p>
              <span style={{ marginLeft: 'auto', background: airColor + '18', color: airColor, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{air.grade}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{ label: 'PM10 미세먼지', val: air.pm10, max: 150 }, { label: 'PM2.5 초미세먼지', val: air.pm25, max: 75 }].map(item => (
                <div key={item.label} style={{ background: '#F8F9FA', borderRadius: 12, padding: '12px' }}>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', fontWeight: 600 }}>{item.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
                    {item.val}<span style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8' }}> ㎍/㎥</span>
                  </p>
                  <div style={{ height: 4, background: '#E2E8F0', borderRadius: 99 }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, Math.round(item.val / item.max * 100))}%`, background: airColor, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#CBD5E1', margin: '10px 0 0', textAlign: 'right' }}>측정소: {air.station}</p>
          </div>
        )}

        {/* ── ⑤ AI 안내 ── */}
        {explanation && (
          <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #0F766E, #0D9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h12"/></svg>
              </div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>이동 안내</p>
              <span style={{ marginLeft: 'auto', background: '#F0FDFA', color: '#0D9488', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>AI</span>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: '#374151', margin: 0, whiteSpace: 'pre-line' }}>{explanation}</p>
          </div>
        )}

        {/* ── ⑥ 공중화장실 ── */}
        {routeData?.toilets?.length > 0 && (
          <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ToiletIcon size={16} color="#0F172A" />
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>가까운 공중화장실</p>
            </div>
            {routeData.toilets.map((t, i) => (
              <div key={i} style={{ padding: '13px 16px', borderBottom: i < routeData.toilets.length - 1 ? '1px solid #F8FAFC' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ToiletIcon size={16} color="#0D9488" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                  {t.address && <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.address}</p>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ background: '#F8F9FA', color: '#64748B', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>{t.openHour}</span>
                    {t.hasDisabled && <span style={{ background: '#F0FDFA', color: '#0D9488', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>♿ 장애인용</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ⑦ 근처 약국 ── */}
        {routeData?.pharmacies?.length > 0 && (
          <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PillIcon size={16} color="#0F172A" />
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>근처 약국</p>
            </div>
            {routeData.pharmacies.map((p, i) => (
              <div key={i} style={{ padding: '13px 16px', borderBottom: i < routeData.pharmacies.length - 1 ? '1px solid #F8FAFC' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PillIcon size={16} color="#059669" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  {p.address && <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</p>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ background: '#F8F9FA', color: '#64748B', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>{p.hours}</span>
                    {p.tel && (
                      <a href={`tel:${p.tel}`} style={{ background: '#ECFDF5', color: '#059669', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, textDecoration: 'none' }}>{p.tel}</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ⑨ 무더위쉼터 ── */}
        {routeData?.shelters?.length > 0 && (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 16, overflow: 'hidden' }}>
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

        {/* ── ⑧ 데이터 출처 ── */}
        {routeData?.dataSources && (
          <div style={{ padding: '4px 0' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 8 }}>활용 데이터 — 서울 열린데이터광장</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {routeData.dataSources.map((src, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: src.live ? '#F0FDFA' : '#F8F9FA', color: src.live ? '#0D9488' : '#94A3B8', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: `1px solid ${src.live ? '#CCFBF1' : '#E2E8F0'}` }}>
                  {src.live ? <CheckCircle size={11} color="#0D9488" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #CBD5E1', display: 'inline-block' }} />}
                  {src.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── ⑨ 액션 ── */}
        <button onClick={() => navigate('/share', { state: { destination, routeData } })} style={{ width: '100%', border: 'none', borderRadius: 16, background: 'linear-gradient(135deg, #0F766E, #0D9488)', color: '#fff', fontWeight: 800, fontSize: 17, padding: '18px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(13,148,136,0.25)' }}>
          <ShareIcon size={18} color="#fff" /> 보호자에게 공유하기
        </button>
        <button onClick={() => navigate('/emergency')} style={{ width: '100%', border: '1.5px solid #FECACA', borderRadius: 16, background: '#fff', color: '#DC2626', fontWeight: 800, fontSize: 17, padding: '18px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertIcon size={18} color="#DC2626" /> 응급 상황
        </button>
      </div>
    </div>
  )
}
