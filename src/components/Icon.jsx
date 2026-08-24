const SIZES = {
  alarm: '/icons/alarm.png',
  close: '/icons/close.png',
  dashboard: '/icons/dashboard.png',
  forbidden: '/icons/forbidden.png',
  bell: '/icons/notification-bell.png',
  pending: '/icons/pending.png',
  refund: '/icons/refund.png',
  wallet: '/icons/wallet.png',
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
