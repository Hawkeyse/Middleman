import { useEffect, useState } from 'react'
import { X, Headset } from 'lucide-react'
import ChatThread from './ChatThread.jsx'
import { getThread, sendMessage, markRead, getUnreadCount } from '../state/chat.js'
import { requestNotifyPermission } from '../utils/notify.js'
import './SupportChat.css'

function SupportChat({ email, name, onClose }) {
  const [thread, setThread] = useState(() => getThread(email))

  useEffect(() => {
    setThread(getThread(email))
    markRead(email, 'customer')
    requestNotifyPermission()
  }, [email])

  // Keep read up to date while the panel is open and new replies arrive.
  useEffect(() => {
    const sync = () => {
      setThread(getThread(email))
      if (getUnreadCount(email, 'customer') > 0) markRead(email, 'customer')
    }
    window.addEventListener('storage', sync)
    window.addEventListener('mm-chat-updated', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('mm-chat-updated', sync)
    }
  }, [email])

  const send = (text) => {
    const updated = sendMessage(email, { from: 'customer', text, name })
    setThread(updated)
  }

  return (
    <div className="support-chat-backdrop" onClick={onClose}>
      <div className="support-chat-panel" onClick={(e) => e.stopPropagation()}>
        <header className="support-chat-header">
          <div><Headset size={16} /><span>Middleman Support</span></div>
          <button onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <p className="support-chat-sub">Ask us anything about your deals — a real person on the team replies here.</p>
        <ChatThread messages={thread?.messages} onSend={send} selfRole="customer" placeholder="Message support…" />
      </div>
    </div>
  )
}

export default SupportChat
