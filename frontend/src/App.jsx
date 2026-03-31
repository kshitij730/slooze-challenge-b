import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const light = {
  bg: '#f8f9fa', surface: '#ffffff', border: '#e5e7eb',
  text: '#1a1a1a', muted: '#6b7280', accent: '#6366f1',
  accentBg: '#eef2ff', userBubble: '#6366f1', userText: '#ffffff',
  botBubble: '#ffffff', botText: '#1a1a1a',
  inputBg: '#ffffff', navBg: '#ffffff', uploadBg: '#fafafa',
  uploadBorder: '#d1d5db', skeleton: '#f0f0f0',
}
const dark = {
  bg: '#0f1117', surface: '#1a1d27', border: '#2d3148',
  text: '#e8e8e8', muted: '#8b92a8', accent: '#818cf8',
  accentBg: '#1e2035', userBubble: '#4f46e5', userText: '#ffffff',
  botBubble: '#1a1d27', botText: '#e8e8e8',
  inputBg: '#1a1d27', navBg: '#1a1d27', uploadBg: '#13162a',
  uploadBorder: '#2d3148', skeleton: '#2a2f45',
}

export default function App() {
  const [isDark, setIsDark] = useState(false)
  const [file, setFile] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState(null)
  const [chunkCount, setChunkCount] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const c = isDark ? dark : light

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.pdf')) processFile(dropped)
  }

  const processFile = (f) => {
    setFile(f)
    setSessionId(null)
    setMessages([])
    setError(null)
    setChunkCount(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setSessionId(data.session_id)
      setChunkCount(data.chunk_count)
      setMessages([{
        role: 'bot',
        text: `PDF indexed successfully! I found ${data.chunk_count} text chunks. You can now ask me anything about "${file.name}". Try asking me to summarize it!`,
      }])
    } catch {
      setError('Upload failed. Make sure the backend is running on port 8000.')
    } finally {
      setUploading(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim() || !sessionId || asking) return
    const q = question.trim()
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setAsking(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question: q }),
      })
      if (!res.ok) throw new Error('Ask failed')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'bot', text: data.answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setAsking(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() }
  }

  const s = {
    app: { minHeight: '100vh', background: c.bg, color: c.text, display: 'flex', flexDirection: 'column', transition: 'background 0.2s,color 0.2s' },
    nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: `1px solid ${c.border}`, background: c.navBg },
    logo: { fontSize: '17px', fontWeight: '700', letterSpacing: '-0.3px' },
    logoSpan: { color: c.accent },
    toggle: { width: '42px', height: '22px', borderRadius: '11px', border: 'none', background: isDark ? c.accent : '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '3px', transition: 'background 0.2s' },
    thumb: { width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transform: isDark ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 0.2s' },
    main: { flex: 1, maxWidth: '760px', width: '100%', margin: '0 auto', padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: '24px' },
    badge: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: c.accentBg, color: c.accent, fontWeight: '500', marginBottom: '6px' },
    h1: { fontSize: '24px', fontWeight: '700', marginBottom: '6px' },
    subtitle: { fontSize: '14px', color: c.muted },
    uploadZone: {
      border: `2px dashed ${dragOver ? c.accent : c.uploadBorder}`,
      borderRadius: '14px', padding: '32px', textAlign: 'center',
      background: dragOver ? c.accentBg : c.uploadBg,
      cursor: 'pointer', transition: 'all 0.15s',
    },
    uploadIcon: { fontSize: '32px', marginBottom: '10px' },
    uploadMain: { fontSize: '15px', fontWeight: '500', marginBottom: '4px' },
    uploadSub: { fontSize: '13px', color: c.muted, marginBottom: '16px' },
    fileChip: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', background: c.accentBg, color: c.accent, fontSize: '13px', fontWeight: '500', marginBottom: '14px' },
    uploadBtn: { padding: '11px 28px', background: c.accent, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: uploading ? 0.7 : 1 },
    statsRow: { display: 'flex', gap: '12px' },
    statCard: { flex: 1, background: c.surface, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '14px 16px' },
    statLabel: { fontSize: '12px', color: c.muted, marginBottom: '4px' },
    statValue: { fontSize: '20px', fontWeight: '700', color: c.accent },
    chatBox: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    chatMessages: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '280px', maxHeight: '420px', overflowY: 'auto' },
    msgUser: { alignSelf: 'flex-end', background: c.userBubble, color: c.userText, padding: '10px 16px', borderRadius: '14px 14px 4px 14px', fontSize: '14px', maxWidth: '75%', lineHeight: '1.6' },
    msgBot: { alignSelf: 'flex-start', background: c.botBubble, color: c.botText, padding: '10px 16px', borderRadius: '14px 14px 14px 4px', fontSize: '14px', maxWidth: '80%', lineHeight: '1.6', border: `1px solid ${c.border}` },
    typingDot: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: c.muted, margin: '0 2px' },
    inputRow: { display: 'flex', gap: '10px', padding: '14px 16px', borderTop: `1px solid ${c.border}` },
    chatInput: { flex: 1, padding: '10px 14px', borderRadius: '10px', border: `1.5px solid ${c.border}`, fontSize: '14px', background: c.inputBg, color: c.text, outline: 'none', resize: 'none' },
    sendBtn: { padding: '10px 18px', background: c.accent, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: (asking || !sessionId) ? 0.5 : 1 },
    errorBox: { padding: '12px 16px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' },
  }

  return (
    <div style={s.app}>
      <nav style={s.nav}>
        <div style={s.logo}>slooze<span style={s.logoSpan}>AI</span></div>
        <button style={s.toggle} onClick={() => setIsDark(!isDark)}>
          <div style={s.thumb} />
        </button>
      </nav>

      <div style={s.main}>
        <div>
          <div style={s.badge}>📄 Challenge B — PDF QA Agent</div>
          <h1 style={s.h1}>Chat with your PDF</h1>
          <p style={s.subtitle}>Powered by ChromaDB vector search + Google Gemini ADK</p>
        </div>

        {/* Upload zone */}
        <div
          style={s.uploadZone}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
          <div style={s.uploadIcon}>📂</div>
          {!file ? (
            <>
              <div style={s.uploadMain}>Drop a PDF here or click to browse</div>
              <div style={s.uploadSub}>Supports any PDF document</div>
            </>
          ) : (
            <>
              <div style={s.fileChip}>📄 {file.name}</div>
              <br />
              {!sessionId && (
                <button style={s.uploadBtn} onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Indexing PDF...' : 'Index & Analyze PDF'}
                </button>
              )}
              {sessionId && (
                <div style={{ color: '#16a34a', fontSize: '14px', fontWeight: '500' }}>
                  ✓ PDF ready — ask your questions below!
                </div>
              )}
            </>
          )}
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        {/* Stats */}
        {sessionId && (
          <div style={s.statsRow}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Text chunks indexed</div>
              <div style={s.statValue}>{chunkCount}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Vector store</div>
              <div style={s.statValue}>ChromaDB</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>LLM</div>
              <div style={s.statValue}>Gemini</div>
            </div>
          </div>
        )}

        {/* Chat */}
        {messages.length > 0 && (
          <div style={s.chatBox}>
            <div style={s.chatMessages}>
              {messages.map((m, i) => (
                <div key={i} style={m.role === 'user' ? s.msgUser : s.msgBot}>
                  {m.role === 'bot' ? <div className='md-answer'><ReactMarkdown>{m.text}</ReactMarkdown></div> : m.text}
                </div>
              ))}
              {asking && (
                <div style={s.msgBot}>
                  <span style={{ ...s.typingDot, animationDelay: '0ms' }}>·</span>
                  <span style={{ ...s.typingDot, animationDelay: '150ms' }}>·</span>
                  <span style={{ ...s.typingDot, animationDelay: '300ms' }}>·</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={s.inputRow}>
              <textarea
                style={s.chatInput}
                rows={1}
                placeholder="Ask anything about the document..."
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!sessionId || asking}
              />
              <button style={s.sendBtn} onClick={handleAsk} disabled={!sessionId || asking || !question.trim()}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:0.2}50%{opacity:1}}`}</style>
    </div>
  )
}
