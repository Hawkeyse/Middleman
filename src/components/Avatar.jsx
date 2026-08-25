// Shows the uploaded profile picture if there is one, otherwise falls back
// to the caller's own colored-initial box — pass the exact classes that box
// already uses elsewhere (e.g. "avatar avatar-blue" or "profile-avatar") so
// size/radius/background stay owned by that page's CSS; this only adds the
// image-specific bits on top.
function Avatar({ name, avatarUrl, size = 28, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.43) }
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`avatar-photo ${className}`.trim()} style={style} />
  }
  return <span className={className} style={style}>{(name || 'M')[0].toUpperCase()}</span>
}

export default Avatar
