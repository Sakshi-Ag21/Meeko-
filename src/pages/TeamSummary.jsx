import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Navbar } from '../components/Navbar'
import { speakerColor } from '../utils/speakerColor'
import { apiFetch } from '../utils/api'

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
      className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium transition-colors"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function Section({ icon, title, copyText, children }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span>{icon}</span>{title}
        </h2>
        {copyText && <CopyButton text={copyText} />}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function BulletList({ items, color = 'bg-indigo-500' }) {
  if (!items?.length) return <p className="text-sm text-slate-400 italic">None detected.</p>
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${color}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ThemeChips({ themes }) {
  if (!themes?.length) return <p className="text-sm text-slate-400 italic">None detected.</p>
  const colors = [
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((t, i) => (
        <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium ${colors[i % colors.length]}`}>{t}</span>
      ))}
    </div>
  )
}

// Meeting picker with date range + checkbox selector
function MeetingFilter({ meetings, selectedIds, onToggle, onClearAll, dateFrom, dateTo, onDateFrom, onDateTo, loading }) {
  const filtered = meetings.filter(m => {
    if (dateFrom && m.date < dateFrom) return false
    if (dateTo && m.date > dateTo) return false
    return true
  })

  // Sync filtered set into selectedIds when date range changes
  useEffect(() => {
    const filteredIds = new Set(filtered.map(m => m.id))
    // If the date filter removed some IDs, deselect them
    const toRemove = [...selectedIds].filter(id => !filteredIds.has(id))
    if (toRemove.length > 0) toRemove.forEach(id => onToggle(id))
  }, [dateFrom, dateTo]) // eslint-disable-line

  if (loading) return (
    <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-4">
      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => onDateFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => onDateTo(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {/* Meeting list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {selectedIds.size} / {filtered.length} meetings
          </span>
          <div className="flex gap-2">
            <button onClick={() => { filtered.forEach(m => { if (!selectedIds.has(m.id)) onToggle(m.id) }) }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">All</button>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <button onClick={onClearAll} className="text-xs text-slate-400 hover:underline">None</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">No meetings in this date range.</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
            {filtered.map(m => {
              const checked = selectedIds.has(m.id)
              return (
                <button key={m.id} onClick={() => onToggle(m.id)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                    checked ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {checked && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${checked ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{m.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDate(m.date)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function TeamSummary() {
  const [allMeetings, setAllMeetings] = useState([])
  const [loadingMeetings, setLoadingMeetings] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterOpen, setFilterOpen] = useState(true)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiFetch('/meetings')
      .then(r => r.json())
      .then(data => {
        setAllMeetings(Array.isArray(data) ? data : [])
        setSelectedIds(new Set(data.map(m => m.id)))
      })
      .catch(() => {})
      .finally(() => setLoadingMeetings(false))
  }, [])

  const toggle = id => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const generate = async () => {
    if (selectedIds.size === 0) { toast.error('Select at least one meeting.'); return }
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch('/team-summary', {
        method: 'POST',
        body: JSON.stringify({ meeting_ids: [...selectedIds] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')
      setResult(data)
      toast.success('Team summary generated!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openActionsText = result?.open_actions
    ? Object.entries(result.open_actions).map(([n, items]) => `${n}:\n${items.map(i => `  • ${i}`).join('\n')}`).join('\n\n')
    : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-5">

        {/* Header card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Summary</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                AI-generated summary across selected meetings.
              </p>
              {result && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  Based on <span className="font-semibold text-slate-600 dark:text-slate-300">{result.meeting_count} meeting{result.meeting_count !== 1 ? 's' : ''}</span>
                  {' '}· {result.date_range}
                </p>
              )}
            </div>
            <button
              onClick={generate}
              disabled={loading || selectedIds.size === 0}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md"
            >
              {loading ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Generating…</>
              ) : result ? '↺ Regenerate' : '✦ Generate Summary'}
            </button>
          </div>

          {/* Filter panel toggle */}
          <button
            onClick={() => setFilterOpen(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${filterOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Filter meetings
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold">
              {selectedIds.size}
            </span>
            selected
          </button>

          {filterOpen && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <MeetingFilter
                meetings={allMeetings}
                selectedIds={selectedIds}
                onToggle={toggle}
                onClearAll={() => setSelectedIds(new Set())}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFrom={setDateFrom}
                onDateTo={setDateTo}
                loading={loadingMeetings}
              />
            </div>
          )}
        </div>

        {/* Empty / prompt state */}
        {!loading && !result && (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-2xl mx-auto">✦</div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Select meetings above and click <span className="font-semibold text-indigo-600 dark:text-indigo-400">Generate Summary</span>.
            </p>
            {allMeetings.length === 0 && !loadingMeetings && (
              <p className="text-xs text-slate-400">
                No meetings yet?{' '}
                <Link to="/analyze" className="text-indigo-500 hover:underline">Analyse a transcript first →</Link>
              </p>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 animate-pulse">
                <div className="h-10 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl" />
                <div className="p-5 space-y-2">
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-4/5" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-3/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            <Section icon="📋" title="Team Overview" copyText={result.overview?.join('\n• ')}>
              <BulletList items={result.overview} />
            </Section>

            <Section icon="🏷️" title="Recurring Themes" copyText={result.themes?.join(', ')}>
              <ThemeChips themes={result.themes} />
            </Section>

            <Section icon="⚡" title="Key Decisions" copyText={result.decisions?.join('\n• ')}>
              <BulletList items={result.decisions} color="bg-violet-500" />
            </Section>

            <Section icon="✅" title="Open Action Items by Person" copyText={openActionsText}>
              {!result.open_actions || Object.keys(result.open_actions).length === 0 ? (
                <p className="text-sm text-slate-400 italic">No action items found.</p>
              ) : (
                <div className="space-y-5">
                  {Object.entries(result.open_actions).map(([person, items]) => (
                    <div key={person}>
                      <div className="flex items-center gap-2 mb-2">
                        {person === 'Unassigned' ? (
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-600">⚠</span>
                        ) : (
                          <Link to={`/?q=${encodeURIComponent(person)}&filter=participant`}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${speakerColor(person)}`}>
                            {person.charAt(0).toUpperCase()}
                          </Link>
                        )}
                        <span className={`text-sm font-semibold ${person === 'Unassigned' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>{person}</span>
                        <span className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      </div>
                      <ul className="pl-9 space-y-1.5">
                        {items.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon="💡" title="Recommendations" copyText={result.recommendations?.join('\n• ')}>
              <BulletList items={result.recommendations} color="bg-amber-400" />
            </Section>
          </div>
        )}
      </main>
    </div>
  )
}
