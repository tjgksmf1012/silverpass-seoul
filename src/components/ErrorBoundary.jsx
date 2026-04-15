import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F8F9FA', padding: '24px', textAlign: 'center',
      }}>
        {/* 아이콘 */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: '#FEF2F2', display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 20,
        }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none"
            stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
          잠깐 문제가 생겼어요
        </h1>
        <p style={{ fontSize: 16, color: '#64748B', margin: '0 0 28px', lineHeight: 1.7 }}>
          일시적인 오류예요.<br />홈으로 돌아가서 다시 시도해 주세요.
        </p>

        <button
          onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
          style={{
            background: 'linear-gradient(135deg, #0F766E, #0D9488)',
            color: '#fff', border: 'none', borderRadius: 16,
            padding: '16px 32px', fontSize: 17, fontWeight: 800,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(13,148,136,0.25)',
          }}
        >
          홈으로 돌아가기
        </button>

        {/* 개발 환경에서만 에러 상세 표시 */}
        {import.meta.env.DEV && this.state.error && (
          <pre style={{
            marginTop: 24, padding: 14, background: '#1E293B', color: '#F1F5F9',
            borderRadius: 12, fontSize: 11, textAlign: 'left',
            maxWidth: '100%', overflow: 'auto', maxHeight: 160,
          }}>
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    )
  }
}
