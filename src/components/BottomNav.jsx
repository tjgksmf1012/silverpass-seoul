import { useNavigate, useLocation } from 'react-router-dom'
import { HomeIcon, UserIcon, AlertIcon } from './Icons.jsx'

const items = [
  { path: '/',          label: '홈',     Icon: HomeIcon,  activeColor: '#0D9488', activeBg: '#F0FDFA' },
  { path: '/profile',   label: '내정보',  Icon: UserIcon,  activeColor: '#0D9488', activeBg: '#F0FDFA' },
  { path: '/emergency', label: '응급',   Icon: AlertIcon, activeColor: '#DC2626', activeBg: '#FEF2F2' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'rgba(255,255,255,0.97)',
      borderTop: '1px solid #DDE7F0',
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 10px 16px', zIndex: 50,
      boxShadow: '0 -10px 28px rgba(15, 23, 42, 0.08)',
    }} aria-label="주요 메뉴">
      {items.map(({ path, label, Icon, activeColor, activeBg }) => {
        const active = pathname === path
        return (
          <button key={path} onClick={() => navigate(path)} aria-current={active ? 'page' : undefined} style={{
            flex: 1, border: 'none', background: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            cursor: 'pointer', padding: '6px 0 4px', borderRadius: 16,
            minHeight: 66,
          }}>
            <div style={{
              width: 52, height: 36, borderRadius: 14,
              background: active ? activeBg : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}>
              <Icon size={24} color={active ? activeColor : '#64748B'} stroke={2} />
            </div>
            <span style={{
              fontSize: 14, fontWeight: 800,
              color: active ? activeColor : '#475569',
              transition: 'color 0.2s',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
