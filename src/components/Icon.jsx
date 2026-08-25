const SIZES = {
  alarm: '/icons/alarm.png',
  close: '/icons/close.png',
  dashboard: '/icons/dashboard.png',
  forbidden: '/icons/forbidden.png',
  bell: '/icons/notification-bell.png',
  pending: '/icons/pending.png',
  refund: '/icons/refund.png',
  wallet: '/icons/wallet.png',
  agreement: '/icons/agreement.png',
  support: '/icons/support.png',
  verified: '/icons/verified.png',
  verify: '/icons/verify.png',
  profile: '/icons/profile.png',
  buying: '/icons/buying.png',
  selling: '/icons/selling.png',
  ban: '/icons/ban.svg',
}

function Icon({ name, size = 18, className = '' }) {
  return (
    <img
      src={SIZES[name]}
      width={size}
      height={size}
      alt=""
      className={`icon-img${className ? ` ${className}` : ''}`}
    />
  )
}

export default Icon
