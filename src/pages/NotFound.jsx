import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#F8F9FA', padding: '24px', textAlign: 'center',
    }}>
      {/* 아이콘 */}
      <div style={{
        width: 80, height: 80, borderRadius: 22,
        background: '#F0FDFA', display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: 22,
      }}>
        <svg width={40} height={40} viewBox="0 0 24 24" fill="none"
          stroke="#0D9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <path d="M12 10h.01"/>
        </svg>
      </div>

      <p style={{ fontSize: 14, fontWeight: 700, color: '#0D9488', margin: '0 0 8px', letterSpacing: '0.04em' }}>
        길을 잃었어요
      </p>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 10px' }}>
        페이지를 찾을 수 없어요
      </h1>
      <p style={{ fontSize: 16, color: '#64748B', margin: '0 0 32px', lineHeight: 1.7 }}>
        주소를 다시 확인하거나<br />홈으로 돌아가 주세요.
      </p>

      <button
        onClick={() => navigate('/')}
        style={{
          background: 'linear-gradient(135deg, #0F766E, #0D9488)',
          color: '#fff', border: 'none', borderRadius: 16,
          padding: '16px 32px', fontSize: 17, fontWeight: 800,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(13,148,136,0.25)',
        }}
      >
        홈으로 돌아가기
      </button>
    </div>
  )
}
