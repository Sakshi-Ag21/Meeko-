import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Navbar } from '../components/Navbar'
import { speakerColor } from '../utils/speakerColor'
import { apiFetch } from '../utils/api'

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  return (
    <button
      onClick={copy}
      className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium transition-colors"
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}


function BulletList({ items, color = 'bg-indigo-500' }) {
  if (!items?.length) return <p className="text-sm text-slate-400 dark:text-slate-500 italic">None detected.</p>
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

function EditableSection({ icon, title, items, color = 'bg-indigo-500', onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)

  const startEdit = () => { setDraft([...(items ?? [])]);  setEditing(true) }
  const cancel = () => setEditing(false)

  const save = async () => {
    const cleaned = draft.map(s => s.trim()).filter(Boolean)
    setSaving(true)
    try {
      await onSave(cleaned)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const updateItem = (i, val) => {
    const next = [...draft]; next[i] = val; setDraft(next)
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span>{icon}</span> {title}
        </h2>
        <div className="flex items-center gap-2">
          {!editing && <CopyButton text={(items ?? []).join('\n• ')} />}
          {editing ? (
            <>
              <button
                onClick={cancel}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4">
        {editing ? (
          <div className="space-y-2">
            {draft.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <textarea
                  value={item}
                  onChange={e => updateItem(i, e.target.value)}
                  rows={2}
                  className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 leading-relaxed"
                  placeholder="Enter item…"
                />
                <button
                  onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                  className="mt-1.5 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={() => setDraft([...draft, ''])}
              className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add item
            </button>
          </div>
        ) : (
          <BulletList items={items} color={color} />
        )}
      </div>
    </div>
  )
}

// Inline dropdown for assigning an action item to a participant
function AssignDropdown({ current, speakers, onChange }) {
  const [open, setOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setCustomName('')
  }, [open])

  const allOptions = [...speakers.filter(s => s !== 'Unassigned'), 'Unassigned']

  const handleCustomAssign = () => {
    const name = customName.trim()
    if (!name) return
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`text-xs px-2 py-1 rounded border font-medium transition-colors flex items-center gap-1 ${
          current === 'Unassigned'
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'
        }`}
      >
        {current === 'Unassigned' ? 'Assign →' : '↗ Move'}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
          <p className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700 font-medium">
            Assign to…
          </p>
          {allOptions.map(name => (
            <button
              key={name}
              onClick={() => { onChange(name); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                name === current
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {name !== 'Unassigned' ? (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${speakerColor(name)}`}>
                  {name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <span className="text-amber-500">⚠</span>
              )}
              {name}
              {name === current && <span className="ml-auto text-indigo-500">✓</span>}
            </button>
          ))}
          <div className="border-t border-slate-100 dark:border-slate-700 p-2">
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomAssign()}
                placeholder="Type a name…"
                className="flex-1 min-w-0 text-xs rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleCustomAssign}
                disabled={!customName.trim()}
                className="shrink-0 px-2 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PersonWiseSection({ personWise, speakers, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(personWise))); setEditing(true) }
  const cancelEdit = () => setEditing(false)
  const saveEdit = () => { onUpdate(draft); setEditing(false) }

  const updateItem = (person, i, val) => {
    setDraft(d => ({ ...d, [person]: d[person].map((item, j) => j === i ? val : item) }))
  }
  const removeItem = (person, i) => {
    setDraft(d => ({ ...d, [person]: d[person].filter((_, j) => j !== i) }))
  }
  const addItem = (person) => {
    setDraft(d => ({ ...d, [person]: [...(d[person] ?? []), ''] }))
  }
  const addPerson = () => {
    const name = prompt('Enter participant name:')?.trim()
    if (name && !draft[name]) setDraft(d => ({ ...d, [name]: [] }))
  }

  const allPeople = [...new Set([...speakers, ...Object.keys(personWise)])]
  const unassigned = personWise['Unassigned'] ?? []
  const assigned = allPeople.filter(p => p !== 'Unassigned')

  const moveItem = (item, fromPerson, toPerson) => {
    const next = {}
    for (const [person, items] of Object.entries(personWise)) {
      next[person] = items.filter(i => !(i === item && person === fromPerson))
    }
    if (!next[toPerson]) next[toPerson] = []
    next[toPerson] = [...next[toPerson], item]
    if (toPerson !== 'Unassigned' && next['Unassigned']?.length === 0) delete next['Unassigned']
    onUpdate(next)
  }

  const copyText = Object.entries(personWise)
    .map(([n, items]) => `${n}:\n${items.map(i => `  • ${i}`).join('\n')}`)
    .join('\n\n')

  const draftPeople = [...new Set([...speakers, ...Object.keys(draft)])]

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span>👥</span> Person-wise Action Items
        </h2>
        <div className="flex items-center gap-2">
          {!editing && unassigned.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 font-medium">
              {unassigned.length} unassigned
            </span>
          )}
          {!editing && copyText && <CopyButton text={copyText} />}
          {editing ? (
            <>
              <button onClick={cancelEdit}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit}
                className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors">
                Save
              </button>
            </>
          ) : (
            <button onClick={startEdit}
              className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 font-medium transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {editing ? (
          <>
            {draftPeople.map(person => (
              <div key={person}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${speakerColor(person)}`}>
                    {person.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{person}</span>
                </div>
                <div className="pl-9 space-y-2">
                  {(draft[person] ?? []).map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <textarea
                        value={item}
                        onChange={e => updateItem(person, i, e.target.value)}
                        rows={2}
                        className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                      />
                      <button onClick={() => removeItem(person, i)}
                        className="mt-1.5 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addItem(person)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add item
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addPerson}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium flex items-center gap-1 transition-colors border border-dashed border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-lg">
              + Add person
            </button>
          </>
        ) : (
          <>
            {unassigned.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-500">⚠</span>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Unassigned ({unassigned.length})
                  </span>
                  <span className="text-xs text-amber-600/70 dark:text-amber-500/70">
                    — click &quot;Assign →&quot; to attribute each item
                  </span>
                </div>
                <ul className="space-y-2">
                  {unassigned.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item}</span>
                      <AssignDropdown
                        current="Unassigned"
                        speakers={allPeople}
                        onChange={to => moveItem(item, 'Unassigned', to)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assigned.map(person => {
              const items = personWise[person] ?? []
              return (
                <div key={person}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${speakerColor(person)}`}>
                      {person.charAt(0).toUpperCase()}
                    </span>
                    <Link
                      to={`/?q=${encodeURIComponent(person)}&filter=participant`}
                      className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {person}
                    </Link>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="pl-9 text-xs text-slate-400 dark:text-slate-500 italic">No items assigned.</p>
                  ) : (
                    <ul className="pl-9 space-y-2">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span className="flex-1 text-sm text-slate-600 dark:text-slate-400">{item}</span>
                          <AssignDropdown
                            current={person}
                            speakers={allPeople}
                            onChange={to => moveItem(item, person, to)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}

            {assigned.length === 0 && unassigned.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">None detected.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function buildMomEmail({ title, date, speakers, summary, decisions, painPoints, personWise }) {
  const longDate = formatDate(date)
  const attendees = speakers.join(', ')

  const bulletLines = arr => arr?.length ? arr.map(b => `  • ${b}`).join('\n') : '  None.'
  const actionLines = Object.entries(personWise ?? {})
    .filter(([, items]) => items?.length > 0)
    .map(([name, items]) => `${name}:\n${items.map(i => `  • ${i}`).join('\n')}`)
    .join('\n\n') || '  None.'

  const painSection = painPoints?.length
    ? `\n──────────────────────────────\nPAIN POINTS & OPEN QUESTIONS\n──────────────────────────────\n${bulletLines(painPoints)}\n`
    : ''

  return `Subject: MOM – ${title} | ${date}

Hi Team,

Please find the minutes for the meeting "${title}" held on ${longDate}.

Attendees: ${attendees}

──────────────────────────────
EXECUTIVE SUMMARY
──────────────────────────────
${bulletLines(summary)}

──────────────────────────────
KEY DECISIONS
──────────────────────────────
${bulletLines(decisions)}

──────────────────────────────
ACTION ITEMS
──────────────────────────────
${actionLines}
${painSection}
──────────────────────────────

Best regards,
[Your Name]`
}

export function MeetingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState(null)
  const [summary, setSummary] = useState([])
  const [decisions, setDecisions] = useState([])
  const [actionItems, setActionItems] = useState([])
  const [painPoints, setPainPoints] = useState([])
  const [personWise, setPersonWise] = useState({})
  const [loading, setLoading] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showMom, setShowMom] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerDraft, setHeaderDraft] = useState({ title: '', date: '', participants: '' })
  const [savingHeader, setSavingHeader] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    apiFetch(`/meetings/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        setMeeting(data)
        setSummary(data.summary ?? [])
        setDecisions(data.decisions ?? [])
        setActionItems(data.action_items ?? [])
        setPainPoints(data.pain_points ?? [])
        setPersonWise(data.person_wise ?? {})
      })
      .catch(() => { toast.error('Meeting not found.'); navigate('/') })
      .finally(() => setLoading(false))
  }, [id])

  const patchField = async (field, value) => {
    const res = await apiFetch(`/meetings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) {
      toast.error('Failed to save changes.')
      throw new Error('patch failed')
    }
    toast.success('Saved.', { duration: 1500 })
  }

  const handlePersonWiseUpdate = (next) => {
    setPersonWise(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await patchField('person_wise', next)
      } catch {
        toast.error('Failed to save assignments.')
      }
    }, 600)
  }

  const startEditHeader = () => {
    setHeaderDraft({
      title: meeting.title,
      date: meeting.date,
      participants: meeting.speakers.join(', '),
    })
    setEditingHeader(true)
  }

  const saveHeader = async () => {
    const speakers = headerDraft.participants.split(',').map(s => s.trim()).filter(Boolean)
    setSavingHeader(true)
    try {
      await patchField('title', headerDraft.title)
      await patchField('date', headerDraft.date)
      await patchField('speakers', speakers)
      setMeeting(m => ({ ...m, title: headerDraft.title, date: headerDraft.date, speakers }))
      setEditingHeader(false)
    } finally {
      setSavingHeader(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this meeting? This cannot be undone.')) return
    setDeleting(true)
    await apiFetch(`/meetings/${id}`, { method: 'DELETE' })
    toast.success('Meeting deleted.')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 animate-pulse ${i === 1 ? 'h-36' : 'h-28'}`} />
          ))}
        </main>
      </div>
    )
  }

  if (!meeting) return null

  const momEmail = buildMomEmail({
    title: meeting.title, date: meeting.date, speakers: meeting.speakers,
    summary, decisions, painPoints, personWise,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-5">

        {/* Back + Header */}
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors font-medium"
          >
            ← Back to Dashboard
          </button>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-6">
            {editingHeader ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Meeting Title</label>
                  <input
                    value={headerDraft.title}
                    onChange={e => setHeaderDraft(d => ({ ...d, title: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Date</label>
                  <input
                    type="date"
                    value={headerDraft.date}
                    onChange={e => setHeaderDraft(d => ({ ...d, date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Participants <span className="normal-case font-normal text-slate-400">(comma separated)</span></label>
                  <input
                    value={headerDraft.participants}
                    onChange={e => setHeaderDraft(d => ({ ...d, participants: e.target.value }))}
                    placeholder="Sakshi, Rahul, Priya"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={saveHeader} disabled={savingHeader}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                    {savingHeader ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingHeader(false)}
                    className="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      {meeting.title}
                    </h1>
                    <button onClick={startEditHeader}
                      className="shrink-0 p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit title, date & participants">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                    📅 {formatDate(meeting.date)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {meeting.speakers.map(name => (
                      <Link
                        key={name}
                        to={`/?q=${encodeURIComponent(name)}&filter=participant`}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-opacity hover:opacity-75 ${speakerColor(name)}`}
                        title={`See all meetings with ${name}`}
                      >
                        {name}
                      </Link>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setShowMom(v => !v)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors border flex items-center gap-2 ${
                    showMom
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                  }`}
                >
                  ✉️ {showMom ? 'Hide MOM' : 'Draft MOM'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOM Email Draft */}
        {showMom && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-indigo-100 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-900/20">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                ✉️ Minutes of Meeting — Email Draft
              </h2>
              <CopyButton text={momEmail} label="Copy Email" />
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Edit summary, decisions, or action items above — this draft updates automatically. Copy and paste into your email client.
              </p>
              <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-mono bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 p-4 overflow-x-auto">
                {momEmail}
              </pre>
            </div>
          </div>
        )}

        {/* Executive Summary — editable */}
        <EditableSection
          icon="📋"
          title="Executive Summary"
          items={summary}
          color="bg-indigo-500"
          onSave={async val => { await patchField('summary', val); setSummary(val) }}
        />

        {/* Key Decisions — editable */}
        <EditableSection
          icon="⚡"
          title="Key Decisions"
          items={decisions}
          color="bg-violet-500"
          onSave={async val => { await patchField('decisions', val); setDecisions(val) }}
        />

        {/* Action Items — editable */}
        <EditableSection
          icon="✅"
          title="Action Items (Overall)"
          items={actionItems}
          color="bg-emerald-500"
          onSave={async val => { await patchField('action_items', val); setActionItems(val) }}
        />

        {/* Pain Points — editable */}
        <EditableSection
          icon="🚧"
          title="Pain Points & Open Questions"
          items={painPoints}
          color="bg-rose-500"
          onSave={async val => { await patchField('pain_points', val); setPainPoints(val) }}
        />

        {/* Person-wise — interactive assignment */}
        <PersonWiseSection
          personWise={personWise}
          speakers={meeting.speakers}
          onUpdate={handlePersonWiseUpdate}
        />

        {/* Full Transcript (collapsible) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowTranscript(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              📄 Full Transcript
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {showTranscript ? '▲ Hide' : '▼ Show'}
            </span>
          </button>
          {showTranscript && (
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800">
              <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed font-mono">
                {meeting.transcript}
              </pre>
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="flex justify-end pb-6">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : '🗑️ Delete Meeting'}
          </button>
        </div>

      </main>
    </div>
  )
}
