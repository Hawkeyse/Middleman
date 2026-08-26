import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import './TrustCard.css'

const W = 1200
const H = 630

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Hand-drawn on canvas rather than pulled in via an html-to-image library —
// the card is simple enough, and this avoids a new dependency just to let
// someone download a PNG of their own stats.
function TrustCard({ name, username, avatarUrl, trustScore, boughtCount, soldCount, verified, memberSince, premium, cardStyle }) {
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)
  const accentFont = cardStyle?.fontFamily || "'Space Grotesk', sans-serif"
  const bg = cardStyle?.bg || ['#172b67', '#0a1638']
  const bgStart = bg[0]
  const bgEnd = bg[1]

  useEffect(() => {
    let cancelled = false
    const logo = new Image()
    logo.src = '/middleman-logo.png'
    const photo = new Image()
    if (avatarUrl) photo.src = avatarUrl

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')

      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, bgStart)
      grad.addColorStop(1, bgEnd)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      const glow = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, 520)
      glow.addColorStop(0, 'rgba(76,124,255,0.35)')
      glow.addColorStop(1, 'rgba(76,124,255,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)

      // Tiled diagonal watermark — under everything else, faint enough not
      // to fight the real content but present across the whole card so a
      // cropped screenshot still carries it. Same idea as a certificate
      // watermark: makes the card harder to pass off as edited/fake.
      ctx.save()
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip()
      ctx.globalAlpha = 0.05
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 34px ${accentFont}`
      ctx.textBaseline = 'alphabetic'
      ctx.translate(W / 2, H / 2)
      ctx.rotate(-18 * Math.PI / 180)
      ctx.translate(-W / 2, -H / 2)
      for (let y = -200; y < H + 300; y += 84) {
        for (let x = -300; x < W + 300; x += 320) {
          ctx.fillText('MIDDLEMAN', x, y)
        }
      }
      ctx.restore()

      ctx.save()
      roundRect(ctx, 0, 0, W, H, 0)
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.stroke()
      ctx.restore()

      if (logo.complete && logo.naturalWidth) {
        ctx.save()
        roundRect(ctx, 72, 64, 56, 56, 14)
        ctx.clip()
        ctx.drawImage(logo, 72, 64, 56, 56)
        ctx.restore()
      }
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.font = `700 30px ${accentFont}`
      ctx.fillText('middleman', 72 + 68, 64 + 28)

      let badgeRightEdge = W - 72
      if (premium) {
        const bw = 172, bh = 42, bx = badgeRightEdge - bw, by = 58
        ctx.fillStyle = 'rgba(255,214,102,0.2)'
        roundRect(ctx, bx, by, bw, bh, 21)
        ctx.fill()
        ctx.fillStyle = '#FFD666'
        ctx.font = "700 16px 'Space Grotesk', sans-serif"
        ctx.textAlign = 'center'
        ctx.fillText('★ PREMIUM', bx + bw / 2, by + bh / 2 + 1)
        ctx.textAlign = 'left'
        badgeRightEdge = bx - 12
      }
      if (verified) {
        const bw = 168, bh = 42, bx = badgeRightEdge - bw, by = 58
        ctx.fillStyle = 'rgba(97,220,170,0.16)'
        roundRect(ctx, bx, by, bw, bh, 21)
        ctx.fill()
        ctx.fillStyle = '#7EE8C0'
        ctx.font = "700 16px 'Space Grotesk', sans-serif"
        ctx.textAlign = 'center'
        ctx.fillText('✓ VERIFIED', bx + bw / 2, by + bh / 2 + 1)
        ctx.textAlign = 'left'
      }

      const avatarCx = 72 + 48, avatarCy = 180 + 48
      if (photo.complete && photo.naturalWidth) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(avatarCx, avatarCy, 48, 0, Math.PI * 2)
        ctx.clip()
        const side = Math.min(photo.naturalWidth, photo.naturalHeight)
        ctx.drawImage(photo, (photo.naturalWidth - side) / 2, (photo.naturalHeight - side) / 2, side, side, avatarCx - 48, avatarCy - 48, 96, 96)
        ctx.restore()
      } else {
        const avatarGrad = ctx.createLinearGradient(avatarCx - 48, avatarCy - 48, avatarCx + 48, avatarCy + 48)
        avatarGrad.addColorStop(0, '#4c7cff')
        avatarGrad.addColorStop(1, '#7a5cff')
        ctx.fillStyle = avatarGrad
        ctx.beginPath()
        ctx.arc(avatarCx, avatarCy, 48, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = `700 44px ${accentFont}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((name || 'M')[0].toUpperCase(), avatarCx, avatarCy + 3)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      const nameX = 72 + 116
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 60px ${accentFont}`
      ctx.fillText(name || 'Middleman member', nameX, 244)

      ctx.fillStyle = '#a9b8ec'
      ctx.font = "500 21px 'DM Sans', sans-serif"
      const subtitle = [
        username ? `@${username}` : null,
        memberSince ? `Trusted member since ${memberSince}` : 'Middleman member',
      ].filter(Boolean).join('  ·  ')
      ctx.fillText(subtitle, nameX, 280)

      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(72, 362)
      ctx.lineTo(W - 72, 362)
      ctx.stroke()

      const stats = [
        { value: `${Math.round(trustScore)}`, label: 'TRUST SCORE / 100' },
        { value: `${boughtCount}`, label: 'DEALS BOUGHT' },
        { value: `${soldCount}`, label: 'DEALS SOLD' },
      ]
      const statW = (W - 144) / 3
      stats.forEach((s, i) => {
        const x = 72 + i * statW
        ctx.fillStyle = '#ffffff'
        ctx.font = `700 56px ${accentFont}`
        ctx.fillText(s.value, x, 462)
        ctx.fillStyle = '#8fa3e0'
        ctx.font = "700 13px 'Space Grotesk', sans-serif"
        ctx.fillText(s.label, x, 492)
      })

      ctx.fillStyle = '#6f83c2'
      ctx.font = "500 16px 'DM Sans', sans-serif"
      ctx.fillText('Pay safe. Receive first. · middleman', 72, H - 56)

      if (username) {
        const host = typeof window !== 'undefined' ? window.location.host : 'middleman'
        ctx.fillStyle = '#4c7cff'
        ctx.font = "700 15px 'DM Sans', sans-serif"
        ctx.textAlign = 'right'
        ctx.fillText(`Verify at ${host}/u/${username}`, W - 72, H - 56)
        ctx.textAlign = 'left'
      }

      if (!cancelled) setReady(true)
    }

    // Draws once the logo (always) and the photo (only if there is one) have
    // both settled — "settled" includes a failed photo load, so a broken
    // avatarUrl falls back to the initial instead of blocking the card.
    let pending = avatarUrl ? 2 : 1
    const settle = () => { if (--pending <= 0) draw() }
    const start = () => {
      if (logo.complete) settle(); else logo.onload = logo.onerror = settle
      if (avatarUrl) { if (photo.complete) settle(); else photo.onload = photo.onerror = settle }
    }
    if (document.fonts?.ready) document.fonts.ready.then(start)
    else start()

    return () => { cancelled = true }
  }, [name, username, avatarUrl, trustScore, boughtCount, soldCount, verified, memberSince, premium, accentFont, bgStart, bgEnd])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `middleman-card-${(name || 'me').toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
  }

  return (
    <div className="trust-card-wrap">
      <canvas ref={canvasRef} className="trust-card-canvas" />
      <button className="trust-card-download" onClick={download} disabled={!ready}><Download size={15} /> Download to share</button>
    </div>
  )
}

export default TrustCard
