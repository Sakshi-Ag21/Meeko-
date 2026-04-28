import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useDebounce } from '../hooks/useDebounce'
import { speakerColor } from '../utils/speakerColor'
import { apiFetch } from '../utils/api'

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

const STAT_META = [
  { key: 'totalMeetings',      icon: '📋', label: 'Total Meetings',      grad: 'from-indigo-500 to-indigo-600',   bg: 'bg-indigo-50 dark:bg-indigo-900/30',   text: 'text-indigo-600 dark:text-indigo-400' },
  { key: 'uniqueParticipants', icon: '👥', label: 'Participants',         grad: 'from-violet-500 to-violet-600',   bg: 'bg-violet-50 dark:bg-violet-900/30',   text: 'text-violet-600 dark:text-violet-400' },
  { key: 'thisMonth',          icon: '📅', label: 'This Month',           grad: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
]

function StatCard({ icon, label, value, bg, text }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center text-xl mb-3`}>
        {icon}
      </div>
      <div className={`text-2xl font-bold tabular-nums mb-0.5 ${text}`}>
        {value ?? '—'}
      </div>
      <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function MeetingCard({ meeting, onParticipantClick }) {
  const navigate = useNavigate()
  const MAX = 4
  const shown = meeting.speakers.slice(0, MAX)
  const extra = meeting.speakers.length - MAX

  return (
    <div
      onClick={() => navigate(`/meetings/${meeting.id}`)}
      className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* left accent bar */}
      <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-l-2xl" />

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-2.5">
          <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">
            {meeting.title}
          </h3>
          <span className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap pt-0.5 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700">
            {formatDate(meeting.date)}
          </span>
        </div>

        {meeting.summary?.[0] && (
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
            {meeting.summary[0]}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {shown.map(name => (
            <button
              key={name}
              onClick={e => { e.stopPropagation(); onParticipantClick(name) }}
              title={`Filter by ${name}`}
              className={`text-xs px-2.5 py-0.5 rounded-full border font-medium transition-all hover:scale-105 hover:shadow-sm ${speakerColor(name)}`}
            >
              {name}
            </button>
          ))}
          {extra > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium">
              +{extra}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card p-5 animate-pulse">
      <div className="flex justify-between gap-4 mb-3">
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-52" />
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-24 shrink-0" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
      </div>
      <div className="flex gap-2">
        {[52, 68, 48].map(w => (
          <div key={w} className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full" style={{ width: `${w}px` }} />
        ))}
      </div>
    </div>
  )
}

const FILTERS = [
  { key: 'all', label: 'All meetings' },
  { key: 'title', label: 'Title' },
  { key: 'date', label: 'Date' },
  { key: 'participant', label: 'Participant' },
]

export function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initFilter = searchParams.get('filter') || 'all'
  const initQ = searchParams.get('q') || ''

  const [filterType, setFilterType] = useState(initFilter)
  const [query, setQuery] = useState(filterType !== 'date' ? initQ : '')
  const [dateQuery, setDateQuery] = useState(filterType === 'date' ? initQ : '')
  const [meetings, setMeetings] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const activeQuery = filterType === 'date' ? dateQuery : query
  const debouncedQuery = useDebounce(activeQuery)

  useEffect(() => {
    apiFetch('/stats').then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedQuery && filterType !== 'all') {
      params.set('q', debouncedQuery)
      params.set('filter', filterType)
    }
    apiFetch(`/meetings?${params}`)
      .then(r => r.json())
      .then(data => { setMeetings(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [debouncedQuery, filterType])

  useEffect(() => {
    const p = {}
    if (activeQuery && filterType !== 'all') { p.q = activeQuery; p.filter = filterType }
    setSearchParams(p, { replace: true })
  }, [activeQuery, filterType])

  const handleParticipantClick = name => { setFilterType('participant'); setQuery(name) }
  const handleFilterChange = key => { setFilterType(key); setQuery(''); setDateQuery('') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-7">

        {/* Page header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Your meeting intelligence hub</p>
          </div>
          <Link
            to="/analyze"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-150"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Analysis
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {STAT_META.map(m => (
            <StatCard key={m.key} icon={m.icon} label={m.label} value={stats?.[m.key]} bg={m.bg} text={m.text} />
          ))}
        </div>

        {/* Search + Filter */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card p-4 space-y-3">
          {filterType === 'date' ? (
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={dateQuery}
                onChange={e => setDateQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-10 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
              {dateQuery && (
                <button onClick={() => setDateQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-xs font-bold">
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={
                  filterType === 'participant' ? 'Search by participant name…' :
                  filterType === 'title' ? 'Search by meeting title…' :
                  'Search all meetings…'
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-10 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-xs font-bold">
                  ✕
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                  filterType === f.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meeting list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl mx-auto">
              📭
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-400 font-semibold">
                {activeQuery ? `No meetings match "${activeQuery}"` : 'No meetings yet'}
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {activeQuery ? 'Try a different search or filter.' : 'Analyse your first transcript to get started.'}
              </p>
            </div>
            {!activeQuery && (
              <Link
                to="/analyze"
                className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                Analyze your first transcript →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium px-1">
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
              {activeQuery ? ` for "${activeQuery}"` : ''}
            </p>
            {meetings.map(m => (
              <MeetingCard key={m.id} meeting={m} onParticipantClick={handleParticipantClick} />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
