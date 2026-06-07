import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTheme } from '../providers/ThemeProvider'
import { useAuth } from '../providers/AuthProvider'
import { apiFetch } from '../utils/api'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/team-summary', label: 'Team Summary' },
  { to: '/ask-ai', label: 'Ask AI' },
  { to: '/analyze', label: 'New Analysis' },
  { to: '/import', label: 'Import' },
  { to: '/download', label: '🎙 Recorder' },
]

function JoinTeamModal({ onClose }) {
  const { addTeam } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async e => {
    e.preventDefault()
    const token = code.trim().split('/').pop()
    setLoading(true)
    try {
      const res = await apiFetch(`/teams/join/${token}`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      addTeam({ id: data.id, name: data.name, role: data.role ?? 'member' })
      toast.success(`Joined "${data.name}"!`)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Join a team</h2>
            <p className="text-xs text-slate-500 mt-0.5">Paste the invite link your admin shared</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-bold">✕</button>
        </div>
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            required
            autoFocus
            placeholder="https://… or paste the invite code"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
          />
          <button type="submit" disabled={loading || !code.trim()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md">
            {loading ? 'Joining…' : 'Join team'}
          </button>
        </form>
      </div>
    </div>
  )
}

function TeamSwitcher() {
  const { teams, currentTeam, switchTeam } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!currentTeam) return null

  return (
    <>
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[140px]">
          <span className="truncate">{currentTeam.name}</span>
          <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card-lg overflow-hidden">
            <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
              Your teams
            </p>
            {teams.map(t => (
              <button key={t.id} onClick={() => { switchTeam(t); setOpen(false) }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${t.id === currentTeam.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <span className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {t.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate flex-1">{t.name}</span>
                {t.id === currentTeam.id && <span className="text-indigo-500 text-xs">✓</span>}
              </button>
            ))}
            <div className="border-t border-slate-100 dark:border-slate-700 p-1.5 space-y-0.5">
              <button onClick={() => { navigate('/teams/new'); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors font-semibold">
                + Create new team
              </button>
              <button onClick={() => { setShowJoin(true); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors font-semibold">
                🔗 Join a team
              </button>
              {currentTeam.role === 'admin' && (
                <button onClick={() => { navigate(`/teams/${currentTeam.id}/settings`); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  ⚙ Team settings
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showJoin && createPortal(<JoinTeamModal onClose={() => setShowJoin(false)} />, document.body)}
    </>
  )
}

function HelpModal({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Help & Support</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {[
            { q: 'How do I analyze a meeting?', a: 'Click "New Analysis" in the navbar, paste your transcript, add a title and date, then click Analyze.' },
            { q: 'What transcript formats are supported?', a: 'Plain text, Fireflies exports, and any "Speaker: text" format. Upload .txt, .pdf, or .docx files, or paste directly.' },
            { q: 'How do I invite someone to my team?', a: 'Go to Team Settings (via the team switcher) and copy your invite link. Share it with your teammate.' },
            { q: 'How do I join a team?', a: 'Click your team name in the top-left, then "Join a team", and paste the invite link your admin shared.' },
            { q: 'Can I edit the analysis after it\'s saved?', a: 'Yes — open any meeting and click the edit icon on Summary, Decisions, or Action Items to make changes.' },
            { q: 'What is Ask AI?', a: 'Ask AI lets you have a conversation about your meetings — ask questions, get insights, or surface patterns across multiple meetings.' },
            { q: 'What is Team Summary?', a: 'Team Summary generates a cross-meeting report — themes, decisions, and open actions across all or selected meetings.' },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{q}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Still need help? Reach out at{' '}
            <a href="mailto:sakshi@buyhatke.com" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              sakshi@buyhatke.com
            </a>
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white text-xs font-bold transition-colors">
        {user.name.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card-lg overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email?.split('@')[0]}</p>
          </div>
          <div className="p-1.5">
            <button onClick={() => { logout(); navigate('/login'); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors font-medium">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [showHelp, setShowHelp] = useState(false)

  return (
    <>
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="shrink-0">
            <span className="text-lg font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
              MeetIQ
            </span>
          </Link>
          <TeamSwitcher />
        </div>

        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map(({ to, label }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'}`}>
                {label}
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowHelp(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-bold"
            aria-label="Help">
            Help
          </button>
          <button onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
            aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user && <UserMenu />}
        </div>
      </div>
    </header>
    {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  )
}
