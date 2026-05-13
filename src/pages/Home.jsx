import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'
import { Navbar } from '../components/Navbar'
import { apiFetch } from '../utils/api'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const PLACEHOLDER = `Sakshi: Let's discuss the product launch timeline.
Rahul: I'll handle the pricing strategy by next week.
Sakshi: We need to finalise the landing page copy.
Priya: I can take the design mockups by Thursday.
Rahul: Should we also set up the demo environment?
Sakshi: Yes, that's a blocker — Rahul, can you own that?
Rahul: Sure, will do.`

function today() {
  return new Date().toISOString().slice(0, 10)
}

function Label({ children, hint }) {
  return (
    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
      {children}
      {hint && <span className="ml-1.5 normal-case font-normal text-slate-400">{hint}</span>}
    </label>
  )
}

function Field({ children }) {
  return <div>{children}</div>
}

export function Home() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today())
  const [participants, setParticipants] = useState('')
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)


  const inputClass = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"

  const readFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      if (ext === 'txt') {
        setTranscript(await file.text())
        toast.success('File loaded.')
      } else if (ext === 'pdf') {
        toast.info('Reading PDF…')
        const buffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
        let text = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          text += content.items.map(item => item.str).join(' ') + '\n'
        }
        setTranscript(text.trim())
        toast.success('PDF loaded.')
      } else if (ext === 'doc' || ext === 'docx') {
        toast.info('Reading document…')
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
        setTranscript(value.trim())
        toast.success('Document loaded.')
      } else {
        toast.error('Unsupported file. Use .txt, .pdf, .doc, or .docx')
      }
    } catch (err) {
      toast.error('Failed to read file: ' + err.message)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await readFile(file)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await readFile(file)
  }

  const handleSubmit = async () => {
    if (!transcript.trim()) { toast.error('Please paste or upload a transcript first.'); return }
    setLoading(true)
    try {
      const res = await apiFetch('/analyze-transcript', {
        method: 'POST',
        body: JSON.stringify({
          transcript: transcript.trim(),
          title: title.trim() || undefined,
          date: date || undefined,
          speakers: participants.trim()
            ? participants.split(',').map(s => s.trim()).filter(Boolean)
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')
      toast.success('Analysis complete!')
      navigate(`/meetings/${data.id}`)
    } catch (err) {
      toast.error(err.message || 'Failed to analyze transcript.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Hero header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
            ✦ AI-Powered Analysis
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Analyze a Meeting Transcript
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Paste your transcript or upload a file — we&apos;ll extract the summary, decisions, action items, pain points, and more.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card-md overflow-hidden">

          <div className="p-6 space-y-5">

            {/* Title + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <Label>Meeting Title</Label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Product Launch"
                  className={inputClass}
                />
              </Field>
              <Field>
                <Label>Meeting Date</Label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Participants */}
            <Field>
              <Label hint="(optional — comma separated)">Participants</Label>
              <input
                value={participants}
                onChange={e => setParticipants(e.target.value)}
                placeholder="Sakshi, Rahul, Priya, Amit"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                If your transcript doesn&apos;t have speaker labels (e.g. Fireflies copy-paste), adding names here lets the AI attribute action items correctly.
              </p>
            </Field>

            {/* Transcript — drop zone */}
            <Field>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Transcript</Label>
                <div className="flex items-center gap-3">
                  {transcript.trim() && (
                    <button
                      onClick={() => setTranscript('')}
                      className="text-xs text-slate-400 hover:text-rose-500 transition-colors font-medium"
                    >
                      Clear
                    </button>
                  )}
                  <label className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload file
                    <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleFile} />
                  </label>
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 transition-all duration-150 ${
                  dragging
                    ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-900/20'
                    : 'border-transparent'
                }`}
              >
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={13}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-3.5 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow font-mono leading-relaxed"
                />
                {dragging && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-indigo-50/80 dark:bg-indigo-900/40 backdrop-blur-sm pointer-events-none">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xl">📄</div>
                      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Drop to load file</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Accepts .txt, .pdf, .doc, .docx — or drag & drop directly onto the text area.
              </p>
            </Field>

          </div>

          {/* Footer action bar */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Powered by Gemini 2.5 Flash
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-150 shadow-sm hover:shadow-md"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                <>
                  ✦ Generate Summary
                </>
              )}
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}
