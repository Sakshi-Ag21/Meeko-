import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Navbar } from '../components/Navbar'
import { speakerColor } from '../utils/speakerColor'
import { apiFetch } from '../utils/api'

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTs(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Lightweight markdown renderer
function AiMessage({ content }) {
  const lines = content.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { elements.push(<div key={i} className="h-2" />); i++; continue }
    if (/^\d+\.\s/.test(trimmed)) {
      const listItems = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s/, '')); i++
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 pl-1">{listItems.map((item, j) => <li key={j} className="text-sm leading-relaxed"><InlineText text={item} /></li>)}</ol>)
      continue
    }
    if (/^[-•*]\s/.test(trimmed)) {
      const listItems = []
      while (i < lines.length && /^[-•*]\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-•*]\s/, '')); i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1 my-2">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      )
      continue
    }
    if (/^#{2,3}\s/.test(trimmed)) {
      elements.push(<p key={i} className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-3 mb-1"><InlineText text={trimmed.replace(/^#{2,3}\s/, '')} /></p>)
      i++; continue
    }
    elements.push(<p key={i} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300"><InlineText text={trimmed} /></p>)
    i++
  }
  return <div className="space-y-0.5">{elements}</div>
}

function InlineText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-slate-800 dark:text-slate-200">{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="text-xs font-mono bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5">{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MeetingSelector({ meetings, selectedIds, onToggle, loading }) {
  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
  if (!meetings.length) return (
    <div className="text-center py-6">
      <p className="text-xs text-slate-400 italic">No meetings yet.</p>
      <Link to="/analyze" className="text-xs text-indigo-500 hover:underline mt-1 block">Analyse a transcript →</Link>
    </div>
  )
  return (
    <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
      {meetings.map(m => {
        const checked = selectedIds.has(m.id)
        return (
          <button key={m.id} onClick={() => onToggle(m.id)}
            className={`w-full text-left rounded-lg border px-2.5 py-2 transition-all ${
              checked ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                {checked && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${checked ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{m.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{fmtDate(m.date)}</p>
                {m.speakers?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {m.speakers.slice(0, 3).map(name => (
                      <span key={name} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${speakerColor(name)}`}>{name.split(' ')[0]}</span>
                    ))}
                    {m.speakers.length > 3 && <span className="text-xs text-slate-400">+{m.speakers.length - 3}</span>}
                  </div>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

const SUGGESTIONS = [
  'What were the most critical decisions made?',
  'Who has the most unresolved action items?',
  'What recurring pain points keep coming up?',
  'Summarise the key themes and strategic direction.',
  'Which participant is driving the most decisions?',
]

export function AskAI() {
  const [meetings, setMeetings] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loadingMeetings, setLoadingMeetings] = useState(true)

  // Sessions
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  const [question, setQuestion] = useState('')
  const [loadingAI, setLoadingAI] = useState(false)
  const [sidebarTab, setSidebarTab] = useState('sessions') // 'sessions' | 'context'
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Load meetings and sessions on mount
  useEffect(() => {
    apiFetch('/meetings')
      .then(r => r.json())
      .then(data => { setMeetings(data); setSelectedIds(new Set(data.map(m => m.id))) })
      .catch(() => {})
      .finally(() => setLoadingMeetings(false))

    apiFetch('/ai-sessions')
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loadingAI])

  const toggle = id => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  // Load a session
  const loadSession = async (id) => {
    try {
      const res = await apiFetch(`/ai-sessions/${id}`)
      const data = await res.json()
      setActiveSessionId(id)
      setMessages(data.messages ?? [])
      setSelectedIds(new Set(data.meeting_ids ?? []))
    } catch {
      toast.error('Failed to load session.')
    }
  }

  // Create a new session (just clears UI — persists on first message)
  const newSession = () => {
    setActiveSessionId(null)
    setMessages([])
    setSelectedIds(new Set(meetings.map(m => m.id)))
  }

  const deleteSession = async (e, id) => {
    e.stopPropagation()
    await apiFetch(`/ai-sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) newSession()
  }

  const ask = async () => {
    const q = question.trim()
    if (!q || loadingAI) return

    setQuestion('')
    const userMsg = { role: 'user', content: q }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoadingAI(true)

    try {
      // Call AI
      const res = await apiFetch('/ask-ai', {
        method: 'POST',
        body: JSON.stringify({ question: q, meeting_ids: [...selectedIds], history: messages.slice(-8) }),
      })
      let data
      try { data = await res.json() } catch {
        throw new Error(res.status === 504 ? 'Request timed out — try selecting fewer meetings or asking a simpler question.' : 'Server returned an unexpected response.')
      }
      if (!res.ok) throw new Error(data.error || 'Server error')

      const aiMsg = { role: 'ai', content: data.answer }
      const finalMessages = [...nextMessages, aiMsg]
      setMessages(finalMessages)

      // Persist session
      const sessionTitle = q.length > 50 ? q.slice(0, 50) + '…' : q
      if (!activeSessionId) {
        // Create new session
        const sRes = await apiFetch('/ai-sessions', {
          method: 'POST',
          body: JSON.stringify({ title: sessionTitle, messages: finalMessages, meeting_ids: [...selectedIds] }),
        })
        const sData = await sRes.json()
        setActiveSessionId(sData.id)
        setSessions(prev => [{ id: sData.id, title: sessionTitle, message_count: finalMessages.length, updated_at: sData.updated_at, meeting_ids: [...selectedIds] }, ...prev])
      } else {
        // Update existing session
        await apiFetch(`/ai-sessions/${activeSessionId}`, {
          method: 'PATCH',
          body: JSON.stringify({ messages: finalMessages, meeting_ids: [...selectedIds] }),
        })
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, message_count: finalMessages.length, updated_at: new Date().toISOString() } : s))
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: `Sorry, ran into an error: ${err.message}`, error: true }])
    } finally {
      setLoadingAI(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 56px)' }}>

        {/* Left sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-3">

          {/* Tab toggle */}
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card p-1 gap-1">
            {[['sessions', '💬 Sessions'], ['context', '📎 Context']].map(([key, label]) => (
              <button key={key} onClick={() => setSidebarTab(key)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
                  sidebarTab === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Sessions panel */}
          {sidebarTab === 'sessions' && (
            <div className="flex-1 flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <button onClick={newSession}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  New Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingSessions ? (
                  <div className="p-3 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
                ) : sessions.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 italic py-8 px-3">No chats yet. Ask your first question!</p>
                ) : (
                  <div className="p-2 space-y-1">
                    {sessions.map(s => (
                      <button key={s.id} onClick={() => loadSession(s.id)}
                        className={`group w-full text-left rounded-xl px-3 py-2.5 transition-all relative ${
                          s.id === activeSessionId
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                        }`}>
                        <p className={`text-xs font-semibold truncate pr-5 ${s.id === activeSessionId ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                          {s.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtTs(s.updated_at)} · {s.message_count} msg{s.message_count !== 1 ? 's' : ''}</p>
                        <button onClick={e => deleteSession(e, s.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Context (meeting selector) panel */}
          {sidebarTab === 'context' && (
            <div className="flex-1 flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Meeting Context</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedIds(new Set(meetings.map(m => m.id)))} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">All</button>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:underline">None</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5">
                <p className="text-xs text-slate-400 mb-2">{selectedIds.size} / {meetings.length} selected</p>
                <MeetingSelector meetings={meetings} selectedIds={selectedIds} onToggle={toggle} loading={loadingMeetings} />
              </div>
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card overflow-hidden">

          {/* Chat header */}
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {activeSessionId ? sessions.find(s => s.id === activeSessionId)?.title || 'Chat' : 'New Chat'}
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {selectedIds.size === 0 ? 'No meetings selected' : `${selectedIds.size} meeting${selectedIds.size !== 1 ? 's' : ''} in context`}
              </p>
            </div>
            {messages.length > 0 && (
              <button onClick={newSession} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                + New chat
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {messages.length === 0 && (
              <div className="py-8">
                <div className="text-center mb-7">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-2xl mx-auto mb-3">✦</div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Ask anything about your selected meetings</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Factual lookups, strategic analysis, patterns, accountability — anything.</p>
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => { setQuestion(s); inputRef.current?.focus() }}
                      className="w-full text-left text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-sm mt-0.5">✦</div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : msg.error
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-tl-sm'
                      : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
                }`}>
                  {msg.role === 'user'
                    ? <p className="text-sm leading-relaxed">{msg.content}</p>
                    : msg.error
                      ? <p className="text-sm text-red-600 dark:text-red-400">{msg.content}</p>
                      : <AiMessage content={msg.content} />
                  }
                </div>
                {msg.role === 'user' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mt-0.5">Y</div>
                )}
              </div>
            ))}

            {loadingAI && (
              <div className="flex gap-3 justify-start">
                <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-sm">✦</div>
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
            {selectedIds.size === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center mb-2 font-medium">
                Switch to Context tab and select at least one meeting.
              </p>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedIds.size === 0 ? 'Select meetings first…' : 'Ask anything about these meetings…'}
                disabled={selectedIds.size === 0 || loadingAI}
                rows={1}
                style={{ resize: 'none' }}
                className="flex-1 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed max-h-32 overflow-y-auto"
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px' }}
              />
              <button
                onClick={ask}
                disabled={!question.trim() || loadingAI || selectedIds.size === 0}
                className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shadow-sm"
                title="Send (Enter)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line · Sessions auto-saved
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
