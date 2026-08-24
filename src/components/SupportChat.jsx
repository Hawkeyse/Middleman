import { useEffect, useState } from 'react'
import { Headset, Loader2 } from 'lucide-react'
import Icon from './Icon.jsx'
import ChatThread from './ChatThread.jsx'
import { getThread, sendMessage, markRead, getUnreadCount, setTyping, getTypingRole } from '../state/chat.js'
import { requestNotifyPermission } from '../utils/notify.js'
import './SupportChat.css'

const statusCopy = {
  waiting: <><Loader2 size={12} className="spin" /> Looking for an agent…</>,
  active: 'A member of our team is with you.',
  closed: 'This ticket is closed — send a message to start a new one.',
}

function SupportChat({ email, name, onClose }) {
  const [thread, setThread] = useState(() => getThread(email))
  const [teamTyping, setTeamTyping] = useState(false)

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

  // Typing state has its own short-TTL storage/event (see chat.js) so it
  // doesn't ride along with full thread refreshes. Poll too, since the
  // indicator needs to disappear on its own once the TTL lapses, without
  // waiting for a new write to trigger the event.
  useEffect(() => {
    const check = () => setTeamTyping(getTypingRole(email, 'customer') === 'team')
    check()
    window.addEventListener('mm-typing-updated', check)
    const id = window.setInterval(check, 1000)
    return () => {
      window.removeEventListener('mm-typing-updated', check)
      window.clearInterval(id)
    }
  }, [email])

  const send = (text, image) => {
    const updated = sendMessage(email, { from: 'customer', text, image, name })
    setThread(updated)
  }

  const status = thread?.status || 'waiting'

  return (
    <div className="support-chat-backdrop" onClick={onClose}>
      <div className="support-chat-panel" onClick={(e) => e.stopPropagation()}>
        <header className="support-chat-header">
          <div><Headset size={16} /><span>Middleman Support</span></div>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </header>
        <p className={`support-chat-sub ${status}`}>{thread?.messages?.length ? statusCopy[status] : 'Ask us anything about your deals — a real person on the team replies here.'}</p>
        <ChatThread
          messages={thread?.messages}
          onSend={send}
          selfRole="customer"
          placeholder="Message support…"
          onTyping={() => setTyping(email, 'customer')}
          typingLabel={teamTyping ? 'Agent is typing' : null}
        />
      </div>
    </div>
  )
}

export default SupportChat
