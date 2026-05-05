import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { markVisited } from '../services/storage.js'
import { BusIcon, WindIcon, PillIcon, HospitalIcon, PhoneIcon, MapPin } from '../components/Icons.jsx'

const SLIDES = [
  {
    emoji: null,
    icon: 'main',
    title: '실버패스 서울 Care',
    sub: '어르신의 안전한 이동을 도와드려요',
    desc: '서울시 실시간 데이터로\n가장 편한 경로를 알려드려요.',
    features: [
      { Icon: BusIcon,      color: '#2563EB', bg: '#EFF6FF', text: '저상버스 실시간 확인' },
      { Icon: WindIcon,     color: '#059669', bg: '#ECFDF5', text: '미세먼지 대기질 분석' },
      { Icon: PillIcon,     color: '#7C3AED', bg: '#F5F3FF', text: '근처 약국 정보 제공' },
      { Icon: HospitalIcon, color: '#DC2626', bg: '#FEF2F2', text: '응급의료기관 즉시 연결' },
    ],
  },
  {
    icon: 'share',
    title: '보호자와 연결돼요',
    sub: '안심하고 이동하세요',
    desc: '이동 현황을 보호자에게 바로 공유하고\n응급 상황 시 119와 즉시 연결해요.',
    features: [
      { Icon: PhoneIcon, color: '#DC2626', bg: '#FEF2F2', text: '119 응급 신고 바로 연결' },
      { Icon: PhoneIcon, color: '#0D9488', bg: '#F0FDFA', text: '보호자 이동 현황 공유' },
      { Icon: MapPin,    color: '#D97706', bg: '#FFFBEB', text: '자주 가는 곳 즐겨찾기' },
    ],
  },
  {
    icon: 'profile',
    title: '나에게 맞는 경로',
    sub: '프로필을 설정하면 더 정확해요',
    desc: '이동 조건, 보행보조기구 여부에 맞춰\nAI가 최적 경로를 추천해요.',
    features: [],
  },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const slide = SLIDES[step]
  const isLast = step === SLIDES.length - 1

  function next() {
    if (isLast) {
      markVisited()
      navigate('/profile')
    } else {
      setStep(s => s + 1)
    }
  }
  function skip() {
    markVisited()
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>

      {/* 상단 스킵 + 점 인디케이터 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '52px 20px 0' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              height: 4, borderRadius: 99,
              width: i === step ? 24 : 8,
              background: i === step ? '#0D9488' : '#E2E8F0',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
        {!isLast && (
          <button onClick={skip} style={{ background: 'none', border: 'none', color: '#94A3B8', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '4px 8px' }}>
            건너뛰기
          </button>
        )}
      </div>

      {/* 메인 일러스트 영역 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 24px 24px' }}>

        {/* 아이콘 */}
        <div style={{ marginBottom: 28 }}>
          {step === 0 && (
            <div style={{ width: 88, height: 88, borderRadius: 24, background: 'linear-gradient(135deg, #0F766E, #0D9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(13,148,136,0.25)' }}>
              <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          )}
          {step === 1 && (
            <div style={{ width: 88, height: 88, borderRadius: 24, background: '#FEF2F2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneIcon size={44} color="#DC2626" />
            </div>
          )}
          {step === 2 && (
            <div style={{ width: 88, height: 88, borderRadius: 24, background: '#F0FDFA', border: '2px solid #CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          )}
        </div>

        {/* 텍스트 */}
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0D9488', margin: '0 0 8px', letterSpacing: '0.05em' }}>{slide.sub}</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', margin: '0 0 12px', lineHeight: 1.2 }}>{slide.title}</h1>
        <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.8, margin: '0 0 32px', whiteSpace: 'pre-line' }}>{slide.desc}</p>

        {/* 기능 목록 */}
        {slide.features.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slide.features.map(({ Icon, color, bg, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#F8F9FA', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* 마지막 슬라이드 - 프로필 설정 안내 */}
        {isLast && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '이름', desc: '맞춤 인사와 공유 메시지에 사용' },
              { label: '보호자 전화번호', desc: '응급 시 즉시 연결' },
              { label: '이동 조건', desc: '계단·보행보조기구 여부' },
              { label: '자주 가는 곳', desc: '홈 화면 빠른 경로에 표시' },
            ].map(({ label, desc }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8F9FA', borderRadius: 14, padding: '13px 16px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0D9488', flexShrink: 0 }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={next} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '18px 0',
          background: 'linear-gradient(135deg, #0F766E, #0D9488)',
          color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(13,148,136,0.3)',
        }}>
          {isLast ? '프로필 설정하러 가기' : step === SLIDES.length - 2 ? '마지막 단계' : '다음'}
        </button>
        {isLast && (
          <button onClick={skip} style={{ background: 'none', border: 'none', color: '#94A3B8', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '8px 0' }}>
            나중에 설정할게요. 바로 시작
          </button>
        )}
      </div>
    </div>
  )
}
