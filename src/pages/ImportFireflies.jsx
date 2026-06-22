import { useState, useRef } from 'react'
import { Navbar } from '../components/Navbar'
import { apiFetch } from '../utils/api'

const FIREFLIES_GQL = 'https://api.fireflies.ai/graphql'
const STORAGE_KEY = 'fireflies_api_key'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchFirefliesPage(apiKey, skip, limit) {
  const res = await fetch(FIREFLIES_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: `{ transcripts(limit: ${limit}, skip: ${skip}) {
        id title date participants
        sentences { text speaker_name }
      }}`,
    }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data?.transcripts || []
}

function formatTranscript(sentences) {
  if (!sentences?.length) return ''
  const lines = []
  let lastSpeaker = null
  let buffer = []
  for (const { speaker_name, text } of sentences) {
    if (speaker_name !== lastSpeaker) {
      if (buffer.length) lines.push(`${lastSpeaker}: ${buffer.join(' ')}`)
      lastSpeaker = speaker_name
      buffer = [text]
    } else {
      buffer.push(text)
    }
  }
  if (buffer.length) lines.push(`${lastSpeaker}: ${buffer.join(' ')}`)
  return lines.join('\n')
}

function StatusRow({ item }) {
  const colors = {
    ok:      'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    skip:    'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    fail:    'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    pending: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  }
  const icons = { ok: '✓', skip: '–', fail: '✗', pending: '…' }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${colors[item.status]}`}>
      <span className="font-bold shrink-0">{icons[item.status]}</span>
      <span className="truncate flex-1">{item.title}</span>
      <span className="shrink-0 opacity-60">{item.date}</span>
    </div>
  )
}

export function ImportFireflies() {
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [showKey, setShowKey]   = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [keyword, setKeyword]   = useState('')
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(false)
  const [log, setLog]           = useState([])       // { title, date, status }
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [phase, setPhase]       = useState('')       // status text shown above progress bar
  const abortRef = useRef(false)

  function saveKey(val) {
    setApiKey(val)
    if (val) localStorage.setItem(STORAGE_KEY, val)
    else localStorage.removeItem(STORAGE_KEY)
  }

  function addLog(entry) {
    setLog(prev => [entry, ...prev].slice(0, 100))
  }

  async function runImport() {
    if (!apiKey.trim()) return
    abortRef.current = false
    setRunning(true)
    setDone(false)
    setLog([])
    setProgress({ current: 0, total: 0 })

    try {
      // 1. Fetch all transcripts from Fireflies (paginated)
      setPhase('Fetching meetings from Fireflies…')
      const all = []
      let skip = 0
      const limit = 50
      while (true) {
        if (abortRef.current) break
        const batch = await fetchFirefliesPage(apiKey.trim(), skip, limit)
        if (!batch.length) break
        all.push(...batch)
        setPhase(`Fetched ${all.length} meetings from Fireflies…`)
        if (batch.length < limit) break
        skip += limit
        await sleep(300)
      }

      // 2. Filter by date range and keyword
      const kw = keyword.trim().toLowerCase()
      const filtered = all.filter(m => {
        const d = m.date ? new Date(m.date).toISOString().slice(0, 10) : null
        if (!d) return false
        if (dateFrom && d < dateFrom) return false
        if (dateTo   && d > dateTo)   return false
        if (kw && !m.title?.toLowerCase().includes(kw)) return false
        return true
      })

      // 3. Fetch all existing title+date pairs for dedup (no 200-row limit)
      setPhase('Checking for existing meetings…')
      const existingRes = await apiFetch('/meeting-keys')
      const existing = existingRes.ok ? await existingRes.json() : []
      const existingKeys = new Set(
        Array.isArray(existing) ? existing.map(m => `${m.title}||${m.date}`) : []
      )

      const toImport = filtered.filter(m => {
        const date = m.date ? new Date(m.date).toISOString().slice(0, 10) : ''
        return !existingKeys.has(`${m.title}||${date}`)
      })

      setProgress({ current: 0, total: toImport.length })
      setPhase(`${filtered.length} meetings in range · ${toImport.length} new to import`)

      if (!toImport.length) {
        setPhase('All meetings already imported — nothing to do.')
        setDone(true)
        setRunning(false)
        return
      }

      // 4. Import each meeting
      let imported = 0
      let failed = 0
      for (let i = 0; i < toImport.length; i++) {
        if (abortRef.current) break
        const m = toImport[i]
        const date = m.date ? new Date(m.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

        addLog({ title: m.title || 'Untitled', date, status: 'pending' })

        const transcript = formatTranscript(m.sentences)
        if (!transcript.trim()) {
          addLog({ title: m.title || 'Untitled', date, status: 'skip' })
          setProgress(p => ({ ...p, current: i + 1 }))
          continue
        }

        try {
          const res = await apiFetch('/analyze-transcript', {
            method: 'POST',
            body: JSON.stringify({
              transcript,
              title: m.title || 'Untitled Meeting',
              date,
              speakers: m.participants?.filter(Boolean) || [],
            }),
          })
          const data = await res.json()
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
          addLog({ title: m.title || 'Untitled', date, status: 'ok' })
          imported++
        } catch (err) {
          addLog({ title: m.title || 'Untitled', date, status: 'fail', error: err.message })
          failed++
        }

        setProgress({ current: i + 1, total: toImport.length })
        setPhase(`Importing… ${i + 1} / ${toImport.length}`)

        if (i < toImport.length - 1) await sleep(4000)
      }

      setPhase(abortRef.current
        ? `Stopped. ${imported} imported, ${failed} failed.`
        : `Done! ${imported} imported, ${failed} failed.`)
      setDone(true)
    } catch (err) {
      setPhase(`Error: ${err.message}`)
    }

    setRunning(false)
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const okCount   = log.filter(l => l.status === 'ok').length
  const failCount = log.filter(l => l.status === 'fail').length
  const skipCount = log.filter(l => l.status === 'skip').length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Import from Fireflies</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect your Fireflies account to bulk-import meeting transcripts into MeetIQ.
          </p>
        </div>

        {/* Config card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-5 mb-6">

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Fireflies API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => saveKey(e.target.value)}
                placeholder="Paste your Fireflies API key"
                disabled={running}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-3.5 py-2.5 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <ol className="text-xs text-slate-400 mt-1.5 space-y-0.5 list-none">
              <li>1. Go to <span className="font-medium text-slate-500 dark:text-slate-400">app.fireflies.ai</span> and log in</li>
              <li>2. Click <span className="font-medium text-slate-500 dark:text-slate-400">Settings</span> in the left sidebar</li>
              <li>3. Open <span className="font-medium text-slate-500 dark:text-slate-400">Developer Settings</span></li>
              <li>4. Copy your API key and paste it above</li>
            </ol>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Date Range <span className="font-normal normal-case">(leave blank to import all)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-400 mb-1 block">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  disabled={running}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-60"
                />
              </div>
              <span className="text-slate-400 mt-5">→</span>
              <div className="flex-1">
                <label className="text-xs text-slate-400 mb-1 block">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  disabled={running}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Keyword filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Title keyword <span className="font-normal normal-case">(leave blank to import all)</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              disabled={running}
              placeholder="e.g. Tech Standup, Sales Call, 1:1"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-60"
            />
            <p className="text-xs text-slate-400 mt-1">Only imports meetings whose title contains this text (case-insensitive).</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={runImport}
              disabled={running || !apiKey.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md"
            >
              {running ? 'Importing…' : 'Start Import'}
            </button>
            {running && (
              <button
                onClick={() => { abortRef.current = true }}
                className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Progress section — shown once import starts */}
        {(running || done || log.length > 0) && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-4">

            {/* Phase text */}
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{phase}</p>

            {/* Progress bar */}
            {progress.total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>{progress.current} of {progress.total}</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Summary chips */}
            {log.length > 0 && (
              <div className="flex gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800">
                  {okCount} imported
                </span>
                {skipCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-700">
                    {skipCount} skipped
                  </span>
                )}
                {failCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 font-medium border border-rose-200 dark:border-rose-800">
                    {failCount} failed
                  </span>
                )}
              </div>
            )}

            {/* Per-meeting log */}
            {log.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {log.map((item, i) => <StatusRow key={i} item={item} />)}
              </div>
            )}

            {/* Done CTA */}
            {done && okCount > 0 && (
              <a
                href="/"
                className="block w-full text-center py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md"
              >
                View meetings in Dashboard →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
