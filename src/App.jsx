import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Route_ from './pages/Route.jsx'
import Share from './pages/Share.jsx'
import Emergency from './pages/Emergency.jsx'
import Onboarding from './pages/Onboarding.jsx'
import { isFirstVisit } from './services/storage.js'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={isFirstVisit() ? <Navigate to="/onboarding" replace /> : <Home />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/route" element={<Route_ />} />
      <Route path="/share" element={<Share />} />
      <Route path="/emergency" element={<Emergency />} />
    </Routes>
  )
}
