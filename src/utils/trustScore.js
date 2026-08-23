// Shared between Dashboard (the live score) and the shareable trust card
// (Profile) so they can never drift out of sync with each other.
//
// Starts at 50 — neutral/unproven, not almost-trusted by default with zero
// history — and is earned from there: +5 per completed deal (capped at 100,
// i.e. 10 clean deals maxes it out), -10 per warning from the team.
export function calcTrustScore({ completedCount = 0, warningsCount = 0 } = {}) {
  return Math.max(0, Math.min(100, 50 + completedCount * 5 - warningsCount * 10))
}
