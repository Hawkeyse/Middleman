import { useEffect, useRef, useState } from 'react'
import { getTotalUnread, getUnreadCount } from '../state/chat.js'
import { playPing } from '../utils/ping.js'
import { showNotification } from '../utils/notify.js'

// Polls the shared chat store (works within the same tab, where storage events
// don't fire) and also listens for cross-tab updates, so a reply lands with a
// ping + badge whether it came from another tab or the same one.
export function useChatNotify({ email, role, title = 'New message', active = true }) {
  const [unread, setUnread] = useState(0)
  const prevRef = useRef(-1)

  useEffect(() => {
    if (!active) return
    const isTeam = role === 'team'

    const check = () => {
      const count = isTeam ? getTotalUnread('team') : (email ? getUnreadCount(email, 'customer') : 0)
      if (prevRef.current !== -1 && count > prevRef.current) {
        playPing()
        showNotification(title, "You've got a new message on Middleman.")
      }
      prevRef.current = count
      setUnread(count)
    }

    check()
    const id = window.setInterval(check, 2000)
    window.addEventListener('storage', check)
    window.addEventListener('mm-chat-updated', check)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('storage', check)
      window.removeEventListener('mm-chat-updated', check)
    }
  }, [email, role, active, title])

  return unread
}
