import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SeniorIcon, UsersIcon } from '../components/Icons.jsx'
import { getCurrentUser, setRole } from '../services/auth.js'

export default function RoleSelect() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const currentUser = getCurrentUser()
  const canUseGuardianRole = currentUser && currentUser.provider !== 'guest' && currentUser.provider !== 'invite'

  const roles = [
    {
      id: 'user',
      Icon: SeniorIcon,
      iconColor: '#0D9488',
      iconBg: 'bg-brand-50',
      title: '어르신',
      desc: '내 조건에 맞는\n쉬운 길 안내를 받을게요',
      color: 'border-brand-500 bg-brand-50',
      activeColor: 'border-brand-600 bg-brand-100 ring-2 ring-brand-400',
    },
    canUseGuardianRole ? {
      id: 'guardian',
      Icon: UsersIcon,
      iconColor: '#7C3AED',
      iconBg: 'bg-purple-50',
      title: '보호자',
      desc: '어르신의 이동을\n함께 확인하고 싶어요',
      color: 'border-purple-300 bg-purple-50',
      activeColor: 'border-purple-500 bg-purple-100 ring-2 ring-purple-400',
    } : null,
  ].filter(Boolean)

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    try {
      const user = getCurrentUser()
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      if (selected === 'guardian' && (user.provider === 'guest' || user.provider === 'invite')) {
        navigate('/login', { replace: true })
        return
      }
      await setRole(user.id, selected)
      navigate(selected === 'guardian' ? '/guardian' : '/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          어떻게 사용할까요?
        </h1>
        <p className="text-center text-gray-500 text-senior mb-10">
          사용 목적에 맞는 화면을 보여드려요
        </p>

        <div className="space-y-4 mb-10">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelected(role.id)}
              className={`w-full flex items-center gap-5 p-5 rounded-3xl border-2 transition-all active:scale-95 ${
                selected === role.id ? role.activeColor : role.color
              }`}
            >
              <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${role.iconBg}`}>
                <role.Icon size={36} color={role.iconColor} stroke={2.1} />
              </span>
              <div className="text-left">
                <p className="text-xl font-bold text-gray-900">{role.title}</p>
                <p className="text-gray-600 text-senior whitespace-pre-line">{role.desc}</p>
              </div>
              <div className="ml-auto">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selected === role.id
                    ? 'border-brand-600 bg-brand-600'
                    : 'border-gray-300'
                }`}>
                  {selected === role.id && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="currentColor">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full btn-primary py-4 text-lg rounded-2xl disabled:opacity-40"
        >
          {loading ? '설정 중...' : '시작하기'}
        </button>
      </div>
    </div>
  )
}
