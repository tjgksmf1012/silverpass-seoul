import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Route_ from './pages/Route.jsx'
import Share from './pages/Share.jsx'
import Emergency from './pages/Emergency.jsx'
import Onboarding from './pages/Onboarding.jsx'
import { isFirstVisit } from './services/storage.js'

// 별도 컴포넌트로 분리 → React가 매 렌더마다 isFirstVisit()을 새로 평가
function HomeRoute() {
  if (isFirstVisit()) {
    return <Navigate to="/onboarding" replace />
  }
  return <Home />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/route" element={<Route_ />} />
      <Route path="/share" element={<Share />} />
      <Route path="/emergency" element={<Emergency />} />
    </Routes>
  )
}
