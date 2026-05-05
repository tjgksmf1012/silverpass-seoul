import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signInWithEmail, signUpWithEmail, joinAsUser, getRole } from '../services/auth.js'

export default function Login() {
  const navigate = useNavigate()
  // 'select' | 'elder' | 'login' | 'signup'
  const [step, setStep] = useState('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupRole, setSignupRole] = useState('user')

  function goHome() {
    const role = getRole()
    navigate(role === 'guardian' ? '/guardian' : '/', { replace: true })
  }

  async function handleGuestStart() {
    setLoading(true); setError('')
    try {
      if (inviteCode.trim()) {
        await joinAsUser(inviteCode.trim())
      } else {
        const { startAsGuest } = await import('../services/auth.js')
        startAsGuest('어르신')
      }
      goHome()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try { await signInWithEmail(email, password); goHome() }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleEmailSignup(e) {
    e.preventDefault()
    if (!name.trim()) return setError('이름을 입력해 주세요')
    setLoading(true); setError('')
    try { await signUpWithEmail(email, password, name.trim(), phone.trim(), signupRole); goHome() }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleKakao() {
    setLoading(true); setError('')
    try { await signIn(); goHome() }
    catch (e) { setError(e.message || '카카오 로그인에 실패했어요') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-between px-6 py-12">

      {/* 브랜드 */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg">
          <svg viewBox="0 0 40 40" className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="20" cy="14" r="5" />
            <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">실버패스 서울</h1>
      </div>

      <div className="w-full max-w-sm space-y-4">

        {/* 1단계: 누구인지 선택 */}
        {step === 'select' && (
          <>
            <p className="text-center text-gray-500 text-senior mb-2">어떻게 사용하실 건가요?</p>

            {/* 어르신 */}
            <button
              onClick={() => { setStep('elder'); setError('') }}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-3xl border-2 border-brand-200 hover:border-brand-400 transition-all active:scale-95 shadow-sm"
            >
              <span className="text-4xl">👴</span>
              <div className="text-left">
                <p className="text-lg font-bold text-gray-900">어르신이세요?</p>
                <p className="text-sm text-gray-500">이름만 입력하면 바로 시작!</p>
              </div>
            </button>

            {/* 보호자/일반 */}
            <button
              onClick={() => { setStep('login'); setError('') }}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-3xl border-2 border-gray-200 hover:border-gray-400 transition-all active:scale-95 shadow-sm"
            >
              <span className="text-4xl">👨‍👩‍👧</span>
              <div className="text-left">
                <p className="text-lg font-bold text-gray-900">보호자 / 일반 사용자</p>
                <p className="text-sm text-gray-500">계정으로 로그인해요</p>
              </div>
            </button>
          </>
        )}

        {/* 2단계: 어르신 - 이름만 입력 */}
        {step === 'elder' && (
          <div className="space-y-4">
            <button onClick={() => setStep('select')} className="text-sm text-gray-400 flex items-center gap-1">
              ← 뒤로
            </button>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">안녕하세요!</p>
              <p className="text-gray-500 text-senior mt-1">보호자님께 받은 코드를 입력해주세요</p>
            </div>
            <input
              type="text"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="초대 코드 (예: AB12CD)"
              maxLength={8}
              className="input-base text-2xl py-5 text-center tracking-widest font-mono uppercase"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>}
            <button
              onClick={handleGuestStart}
              disabled={loading}
              className="w-full btn-primary py-4 text-xl rounded-2xl disabled:opacity-40"
            >
              {loading ? '시작 중...' : '시작하기'}
            </button>
            <p className="text-center text-xs text-gray-400">코드 없이도 바로 시작할 수 있어요</p>
          </div>
        )}

        {/* 3단계: 보호자 로그인/가입 */}
        {(step === 'login' || step === 'signup') && (
          <div className="space-y-3">
            <button onClick={() => setStep('select')} className="text-sm text-gray-400 flex items-center gap-1">
              ← 뒤로
            </button>

            {/* 탭 */}
            <div className="flex bg-gray-100 rounded-2xl p-1">
              {[{ id: 'login', label: '로그인' }, { id: 'signup', label: '회원가입' }].map(t => (
                <button key={t.id} onClick={() => { setStep(t.id); setError('') }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    step === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >{t.label}</button>
              ))}
            </div>

            {step === 'login' ? (
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required className="input-base" />
                <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required className="input-base" />
                {error && <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>}
                <button type="submit" disabled={loading} className="w-full btn-primary py-4 text-lg rounded-2xl disabled:opacity-50">
                  {loading ? '로그인 중...' : '로그인'}
                </button>
                <Divider />
                <KakaoButton onClick={handleKakao} loading={loading} label="카카오로 로그인" />
              </form>
            ) : (
              <form onSubmit={handleEmailSignup} className="space-y-3">
                {/* 역할 선택 */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'user', icon: '🧑', label: '일반 사용자', sub: '길 안내·정보 이용' },
                    { id: 'guardian', icon: '👨‍👩‍👧', label: '보호자', sub: '어르신 관리·모니터링' },
                  ].map(r => (
                    <button key={r.id} type="button" onClick={() => setSignupRole(r.id)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                        signupRole === r.id
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="text-xl mb-0.5">{r.icon}</p>
                      <p className={`text-sm font-bold ${signupRole === r.id ? 'text-brand-700' : 'text-gray-800'}`}>{r.label}</p>
                      <p className="text-xs text-gray-400">{r.sub}</p>
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="이름" value={name} onChange={e => setName(e.target.value)} required className="input-base" />
                <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required className="input-base" />
                <input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required className="input-base" />
                <input type="tel" placeholder="전화번호 (예: 010-1234-5678)" value={phone} onChange={e => setPhone(e.target.value)} className="input-base" />
                {error && <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>}
                <button type="submit" disabled={loading} className="w-full btn-primary py-4 text-lg rounded-2xl disabled:opacity-50">
                  {loading ? '가입 중...' : '회원가입'}
                </button>
                <Divider />
                <KakaoButton onClick={handleKakao} loading={loading} label="카카오로 가입" />
              </form>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center pb-2">
        시작하면 서비스 이용약관에 동의하게 됩니다
      </p>
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400">또는</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

function KakaoButton({ onClick, loading, label }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-lg active:scale-95 disabled:opacity-60 transition-all"
      style={{ backgroundColor: '#FEE500', color: '#191919' }}
    >
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#191919">
        <path d="M12 3C6.477 3 2 6.589 2 11c0 2.812 1.686 5.3 4.242 6.85L5.17 21.5a.5.5 0 00.77.53l4.523-3.012A11.3 11.3 0 0012 19c5.523 0 10-3.589 10-8s-4.477-8-10-8z" />
      </svg>
      {label}
    </button>
  )
}
