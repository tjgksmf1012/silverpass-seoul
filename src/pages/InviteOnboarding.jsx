import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { joinAsUser } from '../services/auth.js'

export default function InviteOnboarding() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    if (!name.trim()) return setError('성함을 입력해 주세요')
    setLoading(true)
    setError('')
    try {
      await joinAsUser(code, name.trim())
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
            <h1 className="text-3xl font-bold text-gray-900">환영해요!</h1>
            <p className="mt-2 text-gray-500 text-senior leading-relaxed">
              보호자님이 초대해 드렸어요.<br />성함만 입력하면 바로 시작할 수 있어요.
            </p>
          </div>
        </div>

        {/* 이름 입력 */}
        <div className="space-y-4">
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

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            onClick={handleStart}
            disabled={!name.trim() || loading}
            className="w-full btn-primary py-5 text-xl rounded-2xl disabled:opacity-40 mt-2"
          >
            {loading ? '시작 중...' : '시작하기'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          비밀번호 없이 바로 사용할 수 있어요
        </p>
      </div>
    </div>
  )
}
