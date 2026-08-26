import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppStateProvider, useAppState } from './state/AppState.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import BannedScreen from './components/BannedScreen.jsx'
import WarningGate from './components/WarningGate.jsx'
import PinGate from './components/PinGate.jsx'

const Welcome = lazy(() => import('./pages/Welcome.jsx'))
const Signup = lazy(() => import('./pages/Signup.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const AuthAction = lazy(() => import('./pages/AuthAction.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Verify = lazy(() => import('./pages/Verify.jsx'))
const Invite = lazy(() => import('./pages/Invite.jsx'))
const Team = lazy(() => import('./pages/Team.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))
const Faq = lazy(() => import('./pages/Faq.jsx'))
const PublicProfile = lazy(() => import('./pages/PublicProfile.jsx'))

function RequireAuth({ children }) {
  const { authed, authChecked, banned } = useAppState()
  if (!authChecked) return null
  if (!authed) return <Navigate to="/login" replace />
  if (banned) return <BannedScreen />
  return <PinGate><WarningGate>{children}</WarningGate></PinGate>
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/action" element={<AuthAction />} />
        <Route path="/invite/:code" element={<Invite />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="/team" element={<Team />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/verify" element={<RequireAuth><Verify /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
