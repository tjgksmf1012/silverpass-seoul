import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Route_ from './pages/Route.jsx'
import Share from './pages/Share.jsx'
import Emergency from './pages/Emergency.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Login from './pages/Login.jsx'
import RoleSelect from './pages/RoleSelect.jsx'
import GuardianDashboard from './pages/GuardianDashboard.jsx'
import InviteOnboarding from './pages/InviteOnboarding.jsx'
import NotFound from './pages/NotFound.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import { isFirstVisit } from './services/storage.js'
import { getCurrentUser, getRole, syncElderProfileFromSupabase } from './services/auth.js'

const SPLASH_KEY = 'silverpass_splash_done'

function RequireAuth({ children }) {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireElder({ children }) {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (getRole() === 'guardian') return <Navigate to="/guardian" replace />
  return children
}

function HomeRoute() {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (getRole() === 'guardian') return <Navigate to="/guardian" replace />
  if (isFirstVisit()) return <Navigate to="/onboarding" replace />
  return <Home />
}

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem(SPLASH_KEY)
  )

  useEffect(() => {
    const user = getCurrentUser()
    if (user && getRole() === 'user') {
      syncElderProfileFromSupabase(user.id)
    }
  }, [])

  function handleSplashDone() {
    sessionStorage.setItem(SPLASH_KEY, '1')
    setShowSplash(false)
  }

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
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
        <Route path="/guardian"    element={<RequireAuth><GuardianDashboard /></RequireAuth>} />

        {/* 어르신 초대 링크 (로그인 불필요) */}
        <Route path="/invite/:code" element={<InviteOnboarding />} />

        <Route path="*"            element={<NotFound />} />
      </Routes>
    </>
  )
}
