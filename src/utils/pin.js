// The device PIN is a local convenience lock, never a server-checked
// secret — only its SHA-256 hash is stored, scoped per browser and
// account (see PinGate.jsx and PinConfirmModal.jsx for where this is used).
export async function hashPin(pin) {
  const data = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function pinStorageKey(email) {
  return `mm_pin_hash_${email}`
}

export function hasPinSet(email) {
  return !!localStorage.getItem(pinStorageKey(email))
}

export async function setPinForEmail(email, pin) {
  localStorage.setItem(pinStorageKey(email), await hashPin(pin))
}

export async function verifyPin(email, pin) {
  const hash = await hashPin(pin)
  return hash === localStorage.getItem(pinStorageKey(email))
}
