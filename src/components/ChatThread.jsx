import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send } from 'lucide-react'
import Icon from './Icon.jsx'
import './ChatThread.css'

const MAX_IMAGE_DIM = 1200

function timeLabel(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function ChatThread({ messages, onSend, selfRole, placeholder = 'Type a message…', footer, onTyping, typingLabel }) {
  const [text, setText] = useState('')
  const [imageDraft, setImageDraft] = useState(null)
  const [zoomImage, setZoomImage] = useState(null)
  const endRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, typingLabel])

  const submit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed && !imageDraft) return
    onSend(trimmed, imageDraft)
    setText('')
    setImageDraft(null)
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
    onTyping?.()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setImageDraft(await resizeImage(file))
    } catch {
      // silently ignore — worst case they just don't get an attachment
    }
  }

  return (
    <div className="chat-thread">
      <div className="chat-messages">
        {(!messages || messages.length === 0) && <div className="chat-empty">No messages yet.</div>}
        {messages?.map((m, i) => (
          m.from === 'system'
            ? <div key={i} className="chat-system">{m.text}</div>
            : (
              <div key={i} className={m.from === selfRole ? 'chat-bubble self' : 'chat-bubble'}>
                {m.image && <img className="chat-bubble-image" src={m.image} alt="Attachment" onClick={() => setZoomImage(m.image)} />}
                {m.text && <p>{m.text}</p>}
                <small>{timeLabel(m.at)}</small>
              </div>
            )
        ))}
        {typingLabel && <div className="chat-typing"><span></span><span></span><span></span> {typingLabel}</div>}
        <div ref={endRef}></div>
      </div>
      {footer !== undefined ? footer : (
        <form className="chat-input-row" onSubmit={submit}>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFile} hidden />
          <button type="button" className="chat-attach" aria-label="Attach image" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} /></button>
          <div className="chat-input-col">
            {imageDraft && (
              <div className="chat-image-draft">
                <img src={imageDraft} alt="Selected attachment" />
                <button type="button" onClick={() => setImageDraft(null)} aria-label="Remove attachment"><Icon name="close" size={12} /></button>
              </div>
            )}
            <input value={text} onChange={handleTextChange} placeholder={placeholder} />
          </div>
          <button type="submit" aria-label="Send"><Send size={16} /></button>
        </form>
      )}
      {zoomImage && (
        <div className="chat-lightbox" onClick={() => setZoomImage(null)}>
          <button className="chat-lightbox-close" onClick={() => setZoomImage(null)} aria-label="Close"><Icon name="close" size={18} /></button>
          <img src={zoomImage} alt="Full size attachment" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

export default ChatThread
