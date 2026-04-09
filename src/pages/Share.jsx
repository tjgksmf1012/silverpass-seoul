import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { ArrowLeft, ShareIcon, PhoneIcon, ClockIcon, ChevronRight, MapPin, CheckCircle } from '../components/Icons.jsx'
import { getProfile, getHistory } from '../services/storage.js'

export default function Share() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const profile = getProfile()
  const history = getHistory()
  const [copied, setCopied] = useState(false)
  const [notifSent, setNotifSent] = useState(false)

  const currentRoute = state?.routeData
  const destination = state?.destination || history[0]?.destination || '목적지'

  const burdenLabel = currentRoute?.burden === 'low' ? '낮음' : currentRoute?.burden === 'medium' ? '보통' : '높음'
  const shareText = `[실버패스 서울 Care]\n${profile.name || '어르신'}께서 ${destination}(으)로 출발하셨습니다.\n예상 소요시간: ${currentRoute?.duration ?? '--'}분\n이동 부담도: ${burdenLabel}`

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: '실버패스 서울 Care', text: shareText }); setNotifSent(true) } catch {}
    } else {
      await navigator.clipboard.writeText(shareText)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  function callGuardian() {
    if (profile.guardianPhone) {
      window.location.href = `tel:${profile.guardianPhone.replace(/-/g, '')}`
    } else { navigate('/profile') }
  }

  const BURDEN_COLOR = { low: '#059669', medium: '#D97706', high: '#DC2626' }
  const BURDEN_BG    = { low: '#ECFDF5', medium: '#FFFBEB', high: '#FEF2F2' }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', paddingBottom: 100 }}>

      {/* 헤더 */}
      <div style={{ background: '#fff', padding: '52px 16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={18} color="#0F172A" />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>보호자 공유</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>이동 현황을 보호자에게 알려주세요</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 현재 이동 카드 */}
        {currentRoute ? (
          <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>현재 이동</p>
              <span style={{ background: '#ECFDF5', color: '#059669', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>이동 중</span>
            </div>
            <div style={{ padding: '16px' }}>
              {[
                { label: '목적지', value: destination, icon: <MapPin size={15} color="#0D9488" /> },
                { label: '예상 시간', value: `${currentRoute.duration}분`, icon: <ClockIcon size={15} color="#0D9488" /> },
                { label: '저상버스', value: currentRoute.lowFloorBus ? '이용 가능' : '일반 버스', icon: null },
                { label: '날씨', value: currentRoute.weather, icon: null },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {icon}
                    <span style={{ fontSize: 14, color: '#64748B' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: 14, color: '#64748B' }}>이동 부담도</span>
                <span style={{
                  background: BURDEN_BG[currentRoute.burden] || '#F8F9FA',
                  color: BURDEN_COLOR[currentRoute.burden] || '#64748B',
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                }}>{burdenLabel}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: '40px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <MapPin size={22} color="#0D9488" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', margin: '0 0 6px' }}>현재 이동 경로가 없어요</p>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#0D9488', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}>
              경로 찾으러 가기 →
            </button>
          </div>
        )}

        {/* 공유 메시지 미리보기 */}
        <div style={{ background: '#F8F9FA', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>공유 메시지 미리보기</p>
          <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{shareText}</p>
        </div>

        {/* 액션 버튼 */}
        <button onClick={handleShare} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '18px 0',
          background: notifSent || copied ? '#059669' : 'linear-gradient(135deg, #0F766E, #0D9488)',
          color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(13,148,136,0.25)',
        }}>
          {notifSent || copied
            ? <><CheckCircle size={18} color="#fff" /> {copied ? '복사됐어요!' : '공유했어요!'}</>
            : <><ShareIcon size={18} color="#fff" /> 보호자에게 공유하기</>
          }
        </button>

        <button onClick={callGuardian} style={{
          width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '18px 0',
          background: '#fff', fontWeight: 800, fontSize: 17, color: '#0F172A', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <PhoneIcon size={18} color="#0F172A" />
          보호자 전화하기
          {profile.guardianPhone && <span style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8' }}>{profile.guardianPhone}</span>}
        </button>

        {!profile.guardianPhone && (
          <button onClick={() => navigate('/profile')} style={{
            background: 'none', border: 'none', color: '#0D9488', fontWeight: 700,
            fontSize: 14, cursor: 'pointer', textAlign: 'center', padding: '4px 0',
          }}>
            보호자 전화번호를 프로필에서 설정하세요 →
          </button>
        )}

        {/* 최근 이동 기록 */}
        {history.length > 0 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 10, letterSpacing: '0.02em' }}>최근 이동 기록</p>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #F1F5F9' }}>
              {history.slice(0, 5).map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12, borderBottom: i < Math.min(history.length, 5) - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClockIcon size={15} color="#94A3B8" />
                  </div>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{h.destination}</span>
                  <span style={{ fontSize: 12, color: '#CBD5E1' }}>
                    {new Date(h.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
