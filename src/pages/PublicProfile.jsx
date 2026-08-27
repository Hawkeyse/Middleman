import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, PackageX, ShieldCheck } from 'lucide-react'
import Icon from '../components/Icon.jsx'
import Avatar from '../components/Avatar.jsx'
import { getPublicProfile } from '../state/users.js'
import { calcTrustScore } from '../utils/trustScore.js'
import { isPremiumActive } from '../state/premium.js'
import './PublicProfile.css'

function PublicProfile() {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPublicProfile(username).then((p) => { if (!cancelled) { setProfile(p); setLoading(false) } })
    return () => { cancelled = true }
  }, [username])

  if (loading) {
    return (
      <div className="pubprofile-page">
        <div className="pubprofile-card"><Loader2 size={26} className="spin" /></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="pubprofile-page">
        <div className="pubprofile-card">
          <div className="pubprofile-icon missing"><PackageX size={26} /></div>
          <h2>No one here by that name</h2>
          <p>@{username} doesn't match any Middleman account.</p>
          <Link className="pubprofile-back-link" to="/">Go to Middleman</Link>
        </div>
      </div>
    )
  }

  const trustScore = calcTrustScore({ completedCount: profile.completedDealsCount || 0, warningsCount: 0 })
  const retiredHandles = (profile.usernameHistory || []).map((h) => h.username)
  const wasRenamed = profile.viewedAs !== profile.username

  return (
    <div className="pubprofile-page">
      <div className="pubprofile-card">
        <Link className="pubprofile-back-link" to="/"><ArrowLeft size={14} /> Middleman</Link>
        <Avatar name={profile.name || profile.username} avatarUrl={profile.avatarUrl} size={64} className="pubprofile-avatar" />
        <h2>{profile.name || `@${profile.username}`}</h2>
        <div className="pubprofile-handle">
          @{profile.username}
          {profile.verified && <Icon name="verify" size={15} />}
          {profile.isOwner ? (
            <span className="pubprofile-owner">🔥 OWNER</span>
          ) : isPremiumActive(profile.premiumUntil) && <span className="pubprofile-premium">★ PREMIUM</span>}
        </div>
        {wasRenamed && <p className="pubprofile-note">You looked up @{profile.viewedAs} — this account goes by @{profile.username} now.</p>}

        <div className="pubprofile-stats">
          <div><small>TRUST SCORE</small><b>{trustScore}<span>/100</span></b></div>
          <div><small>DEALS COMPLETED</small><b>{profile.completedDealsCount || 0}</b></div>
          <div><small>MEMBER SINCE</small><b>{profile.memberSince ? new Date(profile.memberSince).getFullYear() : '—'}</b></div>
        </div>

        <div className={`pubprofile-verified ${profile.verified ? 'yes' : 'no'}`}>
          <Icon name={profile.verified ? 'verified' : 'forbidden'} size={16} />
          {profile.verified ? 'Identity verified' : 'Not yet identity-verified'}
        </div>

        {retiredHandles.length > 0 && (
          <p className="pubprofile-history">Previously: {retiredHandles.map((h) => `@${h}`).join(', ')}</p>
        )}

        <div className="pubprofile-footer"><ShieldCheck size={13} /> Deals with this account are protected by Middleman escrow.</div>
      </div>
    </div>
  )
}

export default PublicProfile
