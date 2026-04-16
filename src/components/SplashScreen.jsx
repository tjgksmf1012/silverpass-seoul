/**
 * SplashScreen — 앱 시작 시 1.8초 표시되는 브랜드 화면
 * sessionStorage로 세션당 1번만 표시
 */
import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1800)
    const t2 = setTimeout(() => onDone(), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #0F766E 0%, #0D9488 55%, #14B8A6 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.4s ease',
      userSelect: 'none',
    }}>
      {/* 로고 */}
      <div style={{
        width: 100, height: 100, borderRadius: 30,
        background: 'rgba(255,255,255,0.18)',
        border: '2px solid rgba(255,255,255,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        animation: 'splashPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <svg width={50} height={50} viewBox="0 0 24 24" fill="none"
          stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>

      <h1 style={{
        fontSize: 30, fontWeight: 800, color: '#fff',
        margin: '0 0 4px', letterSpacing: '-0.02em',
        animation: 'splashFadeUp 0.5s ease 0.15s both',
      }}>
        실버패스 서울
      </h1>
      <p style={{
        fontSize: 18, fontWeight: 700,
        color: 'rgba(255,255,255,0.85)', margin: 0,
        animation: 'splashFadeUp 0.5s ease 0.2s both',
      }}>Care</p>
      <p style={{
        fontSize: 14, color: 'rgba(255,255,255,0.65)',
        margin: '14px 0 0', fontWeight: 500,
        animation: 'splashFadeUp 0.5s ease 0.3s both',
      }}>
        어르신의 안전한 이동을 도와드려요
      </p>

      {/* 로딩 점 */}
      <div style={{ display: 'flex', gap: 7, marginTop: 52 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'rgba(255,255,255,0.7)',
            animation: `splashDot 1.1s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes splashPop {
          from { transform: scale(0.7); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(12px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes splashDot {
          0%, 100% { transform: translateY(0);  opacity: 0.5 }
          50%       { transform: translateY(-8px); opacity: 1 }
        }
      `}</style>
    </div>
  )
}
