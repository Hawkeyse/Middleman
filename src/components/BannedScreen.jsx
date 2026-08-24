import Icon from './Icon.jsx'
import { useAppState } from '../state/AppState.jsx'
import './BannedScreen.css'

function BannedScreen() {
  const { accountStatus, logout } = useAppState()

  return (
    <div className="banned-page">
      <div className="banned-card">
        <div className="banned-icon"><Icon name="forbidden" size={26} /></div>
        <h2>Your account has been suspended</h2>
        <p>{accountStatus?.banReason || 'This account was suspended for violating Middleman terms.'}</p>
        <p className="banned-sub">If you think this is a mistake, contact support for a review.</p>
        <button onClick={logout}>Log out</button>
      </div>
    </div>
  )
}

export default BannedScreen
