// Removes duplicate meetings from MeetIQ keeping the most recently created one
// Usage: node scripts/deduplicate.js

import * as dotenv from 'dotenv'
dotenv.config({ path: './scripts/.env' })

const TOKEN   = process.env.MEETIQ_TOKEN
const TEAM_ID = process.env.MEETIQ_TEAM_ID
const API     = (process.env.MEETIQ_API_URL || 'https://meeko-henna.vercel.app/api').replace(/\/$/, '')

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
  'X-Team-Id': TEAM_ID,
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchAllMeetings() {
  const res = await fetch(`${API}/meetings`, { headers })
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function dedupeBatch(meetings) {
  const groups = {}
  for (const m of meetings) {
    const key = `${m.title}||${m.date}`
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  }

  const toDelete = []
  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue
    group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    toDelete.push(...group.slice(1))
  }
  return toDelete
}

async function main() {
  let totalDeleted = 0
  let pass = 1

  while (true) {
    console.log(`\nPass ${pass} — fetching meetings...`)
    const meetings = await fetchAllMeetings()
    console.log(`Fetched ${meetings.length} meetings`)

    const toDelete = await dedupeBatch(meetings)
    if (!toDelete.length) {
      console.log('No duplicates found — all clean!')
      break
    }

    console.log(`Found ${toDelete.length} duplicates, deleting...`)
    for (const m of toDelete) {
      const res = await fetch(`${API}/meetings/${m.id}`, { method: 'DELETE', headers })
      if (res.ok) {
        totalDeleted++
        console.log(`  Deleted "${m.title}" (${m.date})`)
      } else {
        console.error(`  Failed to delete "${m.title}" — ${res.status}`)
      }
      await sleep(200)
    }
    pass++
  }

  console.log(`\nDone! Deleted ${totalDeleted} duplicates total.`)
}

main().catch(err => { console.error(err); process.exit(1) })
