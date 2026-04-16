import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Route_ from './pages/Route.jsx'
import Share from './pages/Share.jsx'
import Emergency from './pages/Emergency.jsx'
import Onboarding from './pages/Onboarding.jsx'
import NotFound from './pages/NotFound.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import { isFirstVisit } from './services/storage.js'

const SPLASH_KEY = 'silverpass_splash_done'

function HomeRoute() {
  if (isFirstVisit()) return <Navigate to="/onboarding" replace />
  return <Home />
}

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem(SPLASH_KEY)
  )

  function handleSplashDone() {
    sessionStorage.setItem(SPLASH_KEY, '1')
    setShowSplash(false)
  }

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <Routes>
        <Route path="/"           element={<HomeRoute />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/profile"    element={<Profile />} />
        <Route path="/route"      element={<Route_ />} />
        <Route path="/share"      element={<Share />} />
        <Route path="/emergency"  element={<Emergency />} />
        <Route path="*"           element={<NotFound />} />
      </Routes>
    </>
  )
}
