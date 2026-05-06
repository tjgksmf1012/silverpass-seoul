import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getInviteInfo, joinAsUser } from '../services/auth.js'

export default function InviteOnboarding() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteInfo, setInviteInfo] = useState(null)
  const [checking, setChecking] = useState(true)
  const isRelogin = Boolean(inviteInfo?.isRelogin)
  const codeMissing = !checking && !inviteInfo

  useEffect(() => {
    let cancelled = false
    setChecking(true)
    getInviteInfo(code)
      .then(info => {
        if (cancelled) return
        setInviteInfo(info)
        if (!info) setError('초대 코드를 찾을 수 없어요')
        if (info?.userName) setName(info.userName)
      })
      .catch(() => {
        if (!cancelled) setError('초대 코드를 확인할 수 없어요')
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [code])

  async function handleStart() {
    if (!isRelogin && !name.trim()) return setError('성함을 입력해 주세요')
    setLoading(true)
    setError('')
    try {
      await joinAsUser(code, isRelogin ? null : name.trim())
      navigate('/', { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">

        {/* 브랜드 */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="w-20 h-20 rounded-3xl bg-brand-600 flex items-center justify-center shadow-lg">
            <span className="text-4xl">👴</span>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">{isRelogin ? '다시 연결할게요' : '환영해요!'}</h1>
            <p className="mt-2 text-gray-500 text-senior leading-relaxed">
              {isRelogin
                ? <>보호자님이 다시 접속할 수 있게<br />링크를 보내드렸어요.</>
                : <>보호자님이 초대해 드렸어요.<br />성함만 입력하면 바로 시작할 수 있어요.</>}
            </p>
          </div>
        </div>

        {/* 이름 입력 */}
        <div className="space-y-4">
          {checking ? (
            <div className="bg-white rounded-3xl p-6 text-center shadow-sm">
              <span className="inline-block w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-3 text-gray-500 font-semibold">초대 정보를 확인하고 있어요</p>
            </div>
          ) : isRelogin ? (
            <div className="bg-white rounded-3xl p-5 text-center shadow-sm border border-brand-100">
              <p className="text-sm text-gray-400 font-semibold">연결된 어르신</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{inviteInfo?.userName || '어르신'}</p>
              <p className="mt-2 text-sm text-brand-700 font-semibold">이름 입력 없이 바로 시작할 수 있어요</p>
            </div>
          ) : (
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">성함</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="홍길동"
                className="input-base text-xl py-4 text-center"
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            onClick={handleStart}
            disabled={checking || codeMissing || (!isRelogin && !name.trim()) || loading}
            className="w-full btn-primary py-5 text-xl rounded-2xl disabled:opacity-40 mt-2"
          >
            {loading ? '시작 중...' : (isRelogin ? '바로 시작하기' : '시작하기')}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          비밀번호 없이 바로 사용할 수 있어요
        </p>
      </div>
    </div>
  )
}
