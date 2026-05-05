import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PhoneIcon, ArrowLeft, HospitalIcon } from '../components/Icons.jsx'
import { getProfile } from '../services/storage.js'
import { getNearbyEmergencyHospitals } from '../services/seoulApi.js'

export default function Emergency() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const profile = getProfile()
  const [hospitals, setHospitals] = useState([])
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400])
    getNearbyEmergencyHospitals(profile.district || '종로구').then(setHospitals)
  }, [])

  function call119() { window.location.href = 'tel:119' }
  function callGuardian() {
    if (profile.guardianPhone) {
      window.location.href = `tel:${profile.guardianPhone.replace(/-/g, '')}`
    } else {
      showToast('보호자 전화번호가 설정되어 있지 않아요')
      setTimeout(() => navigate('/profile'), 1500)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#FFF' }}>

      {/* 토스트 알림 */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: '#1E293B', color: '#fff', fontSize: 15, fontWeight: 600, padding: '14px 20px', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', animation: 'fadeIn 0.2s ease' }}>
          {toast}
        </div>
      )}

      {/* 상단 빨간 배너 */}
      <div style={{
        background: 'linear-gradient(160deg, #DC2626 0%, #EF4444 100%)',
        padding: '52px 20px 32px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        {/* 뒤로가기 */}
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 52, left: 16, width: 38, height: 38, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
          <ArrowLeft size={18} color="#fff" />
        </button>

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* 애니메이션 원형 */}
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
            <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
            </div>
          </div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>응급 상황</h1>
          {state?.trigger && (
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: 0 }}>
              "{state.trigger}" 키워드가 감지됐어요
            </p>
          )}
        </div>
        <style>{`
          @keyframes ping {
            75%, 100% { transform: scale(1.8); opacity: 0; }
          }
        `}</style>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 119 버튼 */}
        <button onClick={call119} style={{
          width: '100%', border: 'none', borderRadius: 20, padding: '28px 20px',
          background: '#DC2626', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 8px 24px rgba(220,38,38,0.35)',
          animation: 'pulse-shadow 2s infinite',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneIcon size={26} color="#fff" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>119 신고하기</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '3px 0 0' }}>소방청 응급의료 즉시 연결</p>
          </div>
        </button>

        {/* 보호자 버튼 */}
        <button onClick={callGuardian} style={{
          width: '100%', border: '2px solid #FECACA', borderRadius: 20, padding: '22px 20px',
          background: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneIcon size={24} color="#DC2626" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>보호자 호출</p>
            <p style={{ fontSize: 13, color: profile.guardianPhone ? '#94A3B8' : '#DC2626', margin: '3px 0 0' }}>
              {profile.guardianPhone || '전화번호 미설정. 프로필에서 설정'}
            </p>
          </div>
        </button>

        {/* 근처 응급의료기관 */}
        {hospitals.length > 0 && (
          <div style={{ background: '#fff', border: '1.5px solid #FECACA', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #FEF2F2', display: 'flex', alignItems: 'center', gap: 8 }}>
              <HospitalIcon size={16} color="#DC2626" />
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>근처 응급의료기관</p>
            </div>
            {hospitals.map((h, i) => (
              <div key={i} style={{ padding: '13px 16px', borderBottom: i < hospitals.length - 1 ? '1px solid #FEF2F2' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HospitalIcon size={16} color="#DC2626" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>{h.name}</p>
                    <span style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{h.level}</span>
                  </div>
                  {h.address && <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.address}</p>}
                  {h.tel && (
                    <a href={`tel:${h.tel}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 700, padding: '5px 12px', borderRadius: 20, textDecoration: 'none' }}>
                      <PhoneIcon size={13} color="#DC2626" /> {h.tel}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 안내 사항 */}
        <div style={{ background: '#F8F9FA', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '18px' }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#0F172A', margin: '0 0 14px' }}>응급 시 안내사항</p>
          {[
            '현재 위치를 정확히 말씀하세요',
            '증상을 간단히 설명하세요',
            '혼자 이동하지 마세요',
            '주변 사람에게 도움을 요청하세요',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 3 ? 12 : 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#FEF2F2', border: '1.5px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#DC2626' }}>{i + 1}</span>
              </div>
              <p style={{ fontSize: 16, color: '#374151', margin: 0, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>

        {/* 돌아가기 */}
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: '#94A3B8', fontSize: 14,
          fontWeight: 600, cursor: 'pointer', padding: '8px 0', marginTop: 'auto',
        }}>
          응급 상황이 아니에요. 홈으로 돌아가기
        </button>
      </div>

      <style>{`
        @keyframes pulse-shadow {
          0%, 100% { box-shadow: 0 8px 24px rgba(220,38,38,0.35); }
          50% { box-shadow: 0 8px 32px rgba(220,38,38,0.55); }
        }
      `}</style>
    </div>
  )
}
