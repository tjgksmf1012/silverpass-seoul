import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useState, useEffect } from 'react'
import SplashScreen from './components/SplashScreen.jsx'
import { isFirstVisit } from './services/storage.js'

const Home = lazy(() => import('./pages/Home.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Route_ = lazy(() => import('./pages/Route.jsx'))
const Share = lazy(() => import('./pages/Share.jsx'))
const Emergency = lazy(() => import('./pages/Emergency.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const RoleSelect = lazy(() => import('./pages/RoleSelect.jsx'))
const GuardianDashboard = lazy(() => import('./pages/GuardianDashboard.jsx'))
const InviteOnboarding = lazy(() => import('./pages/InviteOnboarding.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

const SPLASH_KEY = 'silverpass_splash_done'
const ROLE_KEY = 'silverpass_role'
const USER_KEY = 'silverpass_kakao_user'

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? { ...JSON.parse(raw), role: getRole() } : null
  } catch {
    return null
  }
}

function getRole() {
  return localStorage.getItem(ROLE_KEY)
}

function isGuardianAccount(user) {
  return user?.role === 'guardian' && user.provider !== 'guest' && user.provider !== 'invite'
}

function PageLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F3F7FA',
      padding: 24,
      textAlign: 'center',
    }}>
      <div>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '4px solid #CCFBF1',
          borderTopColor: '#0D9488',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ margin: 0, color: '#0F766E', fontSize: 18, fontWeight: 800 }}>화면을 준비하고 있어요</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireElder({ children }) {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (isGuardianAccount(user)) return <Navigate to="/guardian" replace />
  return children
}

function RequireGuardian({ children }) {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (!isGuardianAccount(user)) return <Navigate to="/" replace />
  return children
}

function HomeRoute() {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (isGuardianAccount(user)) return <Navigate to="/guardian" replace />
  if (isFirstVisit()) return <Navigate to="/onboarding" replace />
  return <Home />
}

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem(SPLASH_KEY)
  )

  useEffect(() => {
    const user = getCurrentUser()
    if (user && !isGuardianAccount(user)) {
      import('./services/auth.js')
        .then(({ syncElderProfileFromSupabase }) => syncElderProfileFromSupabase(user.id))
        .catch(() => {})
    }
  }, [])

  function handleSplashDone() {
    sessionStorage.setItem(SPLASH_KEY, '1')
    setShowSplash(false)
  }

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* 인증 */}
          <Route path="/login"       element={<Login />} />
          <Route path="/role-select" element={<RoleSelect />} />

          {/* 어르신 앱 */}
          <Route path="/"            element={<HomeRoute />} />
          <Route path="/onboarding"  element={<RequireElder><Onboarding /></RequireElder>} />
          <Route path="/profile"     element={<RequireElder><Profile /></RequireElder>} />
          <Route path="/route"       element={<RequireElder><Route_ /></RequireElder>} />
          <Route path="/share"       element={<RequireElder><Share /></RequireElder>} />
          <Route path="/emergency"   element={<RequireAuth><Emergency /></RequireAuth>} />

          {/* 보호자 대시보드 (선택적) */}
          <Route path="/guardian"    element={<RequireGuardian><GuardianDashboard /></RequireGuardian>} />

          {/* 어르신 초대 링크 (로그인 불필요) */}
          <Route path="/invite/:code" element={<InviteOnboarding />} />

          <Route path="*"            element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
