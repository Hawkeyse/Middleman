import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import './ChatThread.css'

function timeLabel(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ChatThread({ messages, onSend, selfRole, placeholder = 'Type a message…' }) {
  const [text, setText] = useState('')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  const submit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="chat-thread">
      <div className="chat-messages">
        {(!messages || messages.length === 0) && <div className="chat-empty">No messages yet.</div>}
        {messages?.map((m, i) => (
          <div key={i} className={m.from === selfRole ? 'chat-bubble self' : 'chat-bubble'}>
            <p>{m.text}</p>
            <small>{timeLabel(m.at)}</small>
          </div>
        ))}
        <div ref={endRef}></div>
      </div>
      <form className="chat-input-row" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <button type="submit" aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  )
}

export default ChatThread
