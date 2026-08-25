import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppStateProvider, useAppState } from './state/AppState.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import BannedScreen from './components/BannedScreen.jsx'
import WarningGate from './components/WarningGate.jsx'
import Welcome from './pages/Welcome.jsx'
import Signup from './pages/Signup.jsx'
import Login from './pages/Login.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profile from './pages/Profile.jsx'
import Verify from './pages/Verify.jsx'
import Invite from './pages/Invite.jsx'
import Team from './pages/Team.jsx'
import Terms from './pages/Terms.jsx'
import PublicProfile from './pages/PublicProfile.jsx'

function RequireAuth({ children }) {
  const { authed, authChecked, banned } = useAppState()
  if (!authChecked) return null
  if (!authed) return <Navigate to="/login" replace />
  if (banned) return <BannedScreen />
  return <WarningGate>{children}</WarningGate>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/invite/:code" element={<Invite />} />
      <Route path="/u/:username" element={<PublicProfile />} />
      <Route path="/team" element={<Team />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/verify" element={<RequireAuth><Verify /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1100)
    const doneTimer = window.setTimeout(() => setLoading(false), 1600)
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(doneTimer) }
  }, [])

  return (
    <AppStateProvider>
      {loading && <LoadingScreen leaving={leaving} />}
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppStateProvider>
  )
}

export default App
