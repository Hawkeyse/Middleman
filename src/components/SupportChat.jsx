import { useCallback, useEffect, useState } from 'react'
import { Headset, Loader2 } from 'lucide-react'
import Icon from './Icon.jsx'
import ChatThread from './ChatThread.jsx'
import { getThread, sendMessage, markRead, setTyping, typingFrom } from '../state/chat.js'
import { requestNotifyPermission } from '../utils/notify.js'
import './SupportChat.css'

const statusCopy = {
  waiting: <><Loader2 size={12} className="spin" /> Looking for an agent…</>,
  active: 'A member of our team is with you.',
  closed: 'This ticket is closed — send a message to start a new one.',
}

function SupportChat({ email, name, onClose }) {
  const [thread, setThread] = useState(null)
  const [teamTyping, setTeamTyping] = useState(false)

  // Firestore-backed now (see src/state/chat.js) — polled rather than read
  // synchronously, same convention as everywhere else this session moved
  // off localStorage, so a reply from the team shows up here whatever
  // device/browser it was sent from.
  const sync = useCallback(async () => {
    const t = await getThread(email)
    setThread(t)
    setTeamTyping(typingFrom(t, 'customer') === 'team')
    if ((t?.unreadForCustomerCount || 0) > 0) markRead(email)
  }, [email])

  useEffect(() => {
    sync()
    requestNotifyPermission()
  }, [email, sync])

  useEffect(() => {
    const id = window.setInterval(sync, 2000)
    return () => window.clearInterval(id)
  }, [sync])

  // Mobile browsers throttle (or fully suspend) setInterval timers once a
  // tab is backgrounded/screen-locked — without this, a reply that arrived
  // while the phone was asleep wouldn't show up until the next un-throttled
  // tick, which can lag well behind 2s. Catches up the moment it's visible
  // again instead of waiting on it.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') sync() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [sync])

  const send = async (text, image) => {
    const updated = await sendMessage(email, { text, image, name })
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
          onTyping={setTyping}
          typingLabel={teamTyping ? 'Agent is typing' : null}
        />
      </div>
    </div>
  )
}

export default SupportChat
