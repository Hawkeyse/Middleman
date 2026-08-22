export function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

// Only fires a native OS notification when the tab is actually backgrounded —
// no point interrupting someone already looking at the chat.
export function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return
  try {
    const n = new Notification(title, { body, icon: '/middleman-logo.png' })
    n.onclick = () => window.focus()
  } catch {
    // some browsers throw if constructed outside a user gesture in odd contexts
  }
}
