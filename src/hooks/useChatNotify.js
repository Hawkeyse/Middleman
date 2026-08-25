import { useEffect, useRef, useState } from 'react'
import { getTotalUnread, getUnreadCount } from '../state/chat.js'
import { playPing } from '../utils/ping.js'
import { showNotification } from '../utils/notify.js'

// Polls the (now Firestore-backed) unread count so a reply lands with a
// ping + badge on every device, not just the one it arrived in.
export function useChatNotify({ email, role, title = 'New message', active = true }) {
  const [unread, setUnread] = useState(0)
  const prevRef = useRef(-1)

  useEffect(() => {
    if (!active) return
    const isTeam = role === 'team'
    let cancelled = false

    const check = async () => {
      const count = isTeam ? await getTotalUnread() : (email ? await getUnreadCount(email) : 0)
      if (cancelled) return
      if (prevRef.current !== -1 && count > prevRef.current) {
        playPing()
        showNotification(title, "You've got a new message on Middleman.")
      }
      prevRef.current = count
      setUnread(count)
    }

    check()
    const id = window.setInterval(check, 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [email, role, active, title])

  return unread
}
