// A short two-note chime synthesized with the Web Audio API — no audio asset
// to fetch, works the instant the tab has had any user interaction (required
// by browser autoplay policy, which is already satisfied by the click/keypress
// that led to this code running).
let ctx = null

export function playPing() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()

    const notes = [880, 1175]
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.11
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.26)
    })
  } catch {
    // Web Audio unavailable — silently skip the sound, notifications still work
  }
}
