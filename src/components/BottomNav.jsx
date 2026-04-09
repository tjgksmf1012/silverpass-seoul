import { useNavigate, useLocation } from 'react-router-dom'
import { HomeIcon, UserIcon, ShareIcon } from './Icons.jsx'

const items = [
  { path: '/',        label: '홈',    Icon: HomeIcon  },
  { path: '/profile', label: '프로필', Icon: UserIcon  },
  { path: '/share',   label: '공유',   Icon: ShareIcon },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid #F1F5F9',
      display: 'flex', justifyContent: 'space-around',
      padding: '10px 0 22px', zIndex: 50,
    }}>
      {items.map(({ path, label, Icon }) => {
        const active = pathname === path
        return (
          <button key={path} onClick={() => navigate(path)} style={{
            flex: 1, border: 'none', background: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            cursor: 'pointer', padding: '4px 0',
          }}>
            <div style={{
              width: 44, height: 30, borderRadius: 10,
              background: active ? '#F0FDFA' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}>
              <Icon size={20} color={active ? '#0D9488' : '#94A3B8'} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#0D9488' : '#94A3B8', transition: 'color 0.2s' }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
