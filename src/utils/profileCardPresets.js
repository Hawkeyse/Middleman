// Curated rather than a free color-wheel + font list — Premium is meant to
// look sharp no matter what someone picks, and letting people freely combine
// arbitrary colors and fonts is how you end up with unreadable cards.
export const CARD_BACKGROUNDS = [
  { id: 'aurora', label: 'Aurora', colors: ['#6a5cff', '#3b2fd6'] },
  { id: 'sunset', label: 'Sunset', colors: ['#ff8a5b', '#ff3d81'] },
  { id: 'ocean', label: 'Ocean', colors: ['#00c6ff', '#0059c9'] },
  { id: 'emerald', label: 'Emerald', colors: ['#0fd88f', '#0a7a5c'] },
  { id: 'roseGold', label: 'Rose Gold', colors: ['#ffb199', '#e0527a'] },
  { id: 'midnight', label: 'Midnight', colors: ['#172b67', '#0a1638'] },
  { id: 'noir', label: 'Noir', colors: ['#3a3d45', '#0f1013'] },
  { id: 'gold', label: '24K', colors: ['#f6d365', '#c98910'] },
]

export const CARD_FONTS = [
  { id: 'grotesk', label: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
  { id: 'bungee', label: 'Bungee', family: "'Bungee', cursive" },
  { id: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { id: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif" },
  { id: 'bebas', label: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
  { id: 'caveat', label: 'Caveat', family: "'Caveat', cursive" },
]

export function backgroundById(id) {
  return CARD_BACKGROUNDS.find((b) => b.id === id) || CARD_BACKGROUNDS[5]
}

export function fontById(id) {
  return CARD_FONTS.find((f) => f.id === id) || CARD_FONTS[0]
}
