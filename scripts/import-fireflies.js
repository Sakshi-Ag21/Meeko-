// One-time migration script: Fireflies → MeetIQ
// Usage: node scripts/import-fireflies.js
//
// Set these env vars before running:
//   FIREFLIES_API_KEY   — your Fireflies API key
//   MEETIQ_TOKEN        — your MeetIQ JWT (from localStorage in browser)
//   MEETIQ_TEAM_ID      — your MeetIQ team ID (from localStorage in browser)
//   MEETIQ_API_URL      — e.g. https://meeko-henna.vercel.app/api or http://localhost:5001

import * as dotenv from 'dotenv'
import { writeFileSync, readFileSync, existsSync } from 'fs'

dotenv.config({ path: './scripts/.env' })

const FIREFLIES_KEY = process.env.FIREFLIES_API_KEY
const MEETIQ_TOKEN  = process.env.MEETIQ_TOKEN
const MEETIQ_TEAM   = process.env.MEETIQ_TEAM_ID
const MEETIQ_API    = (process.env.MEETIQ_API_URL || 'https://meeko-henna.vercel.app/api').replace(/\/$/, '')

const PROGRESS_FILE = './scripts/import-progress.json'
const DELAY_MS      = 5000  // 5s between Gemini calls to avoid rate limits
const IMPORT_AFTER  = '2025-05-13'  // Only import meetings strictly after this date

if (!FIREFLIES_KEY || !MEETIQ_TOKEN || !MEETIQ_TEAM) {
  console.error('Missing env vars. Create scripts/.env with FIREFLIES_API_KEY, MEETIQ_TOKEN, MEETIQ_TEAM_ID')
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'))
  }
  return { done: [], failed: [] }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ── Fetch all Fireflies transcripts (paginated) ───────────────────────────────

async function fetchAllFireflies() {
  const all = []
  let skip = 0
  const limit = 50

  console.log('Fetching meetings from Fireflies...')
  while (true) {
    const res = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIREFLIES_KEY}`,
      },
      body: JSON.stringify({
        query: `{
          transcripts(limit: ${limit}, skip: ${skip}) {
            id title date participants
            sentences { text speaker_name }
          }
        }`,
      }),
    })

    const json = await res.json()
    if (json.errors) {
      console.error('Fireflies error:', json.errors[0].message)
      break
    }

    const batch = json.data?.transcripts || []
    if (!batch.length) break

    all.push(...batch)
    console.log(`  Fetched ${all.length} meetings so far...`)

    if (batch.length < limit) break
    skip += limit
    await sleep(500)
  }

  console.log(`Total meetings fetched: ${all.length}`)
  return all
}

// ── Format transcript text from sentences ─────────────────────────────────────

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

// ── Send one meeting to MeetIQ ────────────────────────────────────────────────

async function importToMeetIQ(meeting) {
  const transcript = formatTranscript(meeting.sentences)
  if (!transcript.trim()) return { skipped: true, reason: 'empty transcript' }

  const date = meeting.date
    ? new Date(meeting.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const res = await fetch(`${MEETIQ_API}/analyze-transcript`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEETIQ_TOKEN}`,
      'X-Team-Id': MEETIQ_TEAM,
    },
    body: JSON.stringify({
      transcript,
      title: meeting.title || 'Untitled Meeting',
      date,
      speakers: meeting.participants?.filter(Boolean) || [],
    }),
  })

  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
  return { id: data.id }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const meetings = await fetchAllFireflies()
  const progress = loadProgress()

  const afterDate = meetings.filter(m => {
    const d = m.date ? new Date(m.date).toISOString().slice(0, 10) : null
    return d && d > IMPORT_AFTER
  })
  console.log(`Meetings after ${IMPORT_AFTER}: ${afterDate.length} (of ${meetings.length} total)`)

  const remaining = afterDate.filter(m => !progress.done.includes(m.id))
  console.log(`\n${progress.done.length} already imported. ${remaining.length} remaining.\n`)

  for (let i = 0; i < remaining.length; i++) {
    const m = remaining[i]
    const num = `[${i + 1}/${remaining.length}]`

    try {
      const result = await importToMeetIQ(m)
      if (result.skipped) {
        console.log(`${num} SKIP  "${m.title}" — ${result.reason}`)
        progress.done.push(m.id)
      } else {
        console.log(`${num} OK    "${m.title}" → /meetings/${result.id}`)
        progress.done.push(m.id)
      }
    } catch (err) {
      console.error(`${num} FAIL  "${m.title}" — ${err.message}`)
      progress.failed.push({ id: m.id, title: m.title, error: err.message })
    }

    saveProgress(progress)

    // Wait between calls to avoid overwhelming Gemini
    if (i < remaining.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\nDone! ${progress.done.length} imported, ${progress.failed.length} failed.`)
  if (progress.failed.length) {
    console.log('Failed meetings saved to scripts/import-progress.json')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
