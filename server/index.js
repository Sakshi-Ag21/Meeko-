import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pool, { initDb } from './db.js'
import { signToken, requireAuth, requireTeam } from './auth.js'

dotenv.config()

const app = express()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Strip /api prefix when running as a Vercel serverless function
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/')) req.url = req.url.slice(4)
  else if (req.url === '/api') req.url = '/'
  next()
})

// Initialize DB tables once per cold start, then gate all requests
const dbReady = initDb().catch(err => err) // capture error, don't crash
app.use(async (_req, res, next) => {
  const err = await dbReady
  if (err instanceof Error) return res.status(500).json({ error: 'Database not available.', details: err.message })
  next()
})

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'Meeting Intelligence API' }))

// ─── Transcript helpers ─────────────────────────────────────────────────────

const TIMESTAMP_RE = /^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i
const isTimestamp = line => TIMESTAMP_RE.test(line.trim())

function isFirefliesFormat(lines) {
  let hits = 0
  for (let i = 0; i < lines.length - 1; i++) {
    if (isTimestamp(lines[i + 1]) && lines[i].trim().length > 0 && !lines[i].includes(':')) hits++
  }
  return hits >= 2
}

function normalizeFireflies(lines) {
  const out = []; let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line && !isTimestamp(line) && isTimestamp((lines[i + 1] || '').trim())) {
      const speaker = line; i += 2
      const textLines = []
      while (i < lines.length && lines[i].trim() && !isTimestamp((lines[i + 1] || '').trim())) {
        textLines.push(lines[i].trim()); i++
      }
      if (textLines.length) out.push(`${speaker}: ${textLines.join(' ')}`)
    } else { if (line) out.push(line); i++ }
  }
  return out.join('\n')
}

function extractSpeakers(transcript) {
  const seen = new Set()
  for (const line of transcript.split('\n')) {
    const m = line.match(/^([^:]+):/)
    if (m) { const name = m[1].trim(); if (name.length > 0 && name.length < 80) seen.add(name) }
  }
  return [...seen]
}

const preprocessTranscript = raw => { const lines = raw.split('\n'); return isFirefliesFormat(lines) ? normalizeFireflies(lines) : raw }
const hasInlineSpeakers = transcript => transcript.split('\n').some(l => /^[^:]{1,60}:/.test(l.trim()))

function buildPrompt(transcript, speakers) {
  const hasSpeakerLabels = hasInlineSpeakers(transcript)
  const list = speakers.length > 0 ? speakers.join('\n') : 'None provided.'
  const attributionRule = hasSpeakerLabels
    ? `- The transcript contains speaker labels (e.g. "Name: text"). Use them to map actions to the exact speaker name from the list above.`
    : `- The transcript has NO speaker labels. Use first-person language clues to infer who is committing to each action.
- If attribution is unclear, put the item under "Unassigned".
- EVERY participant from the list above must appear as a key in "person_wise", even if their array is empty.`

  return `You are an executive meeting analyst.
Participants:\n${list}

Respond in this EXACT JSON format — no markdown fences, raw JSON only:
{"summary":["bullet"],"decisions":["decision"],"action_items":["action"],"pain_points":["pain point"],"person_wise":{"Name":["action"],"Unassigned":[]}}

Rules:
${attributionRule}
- "summary": 5–7 crisp bullets | "decisions": all decisions | "action_items": all action items
- "pain_points": unresolved blockers, open questions, gaps the team acknowledged

Transcript:\n${transcript}`
}

// ─── Auth routes ────────────────────────────────────────────────────────────

app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'name, email and password are required.' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })

  const existing = (await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()])).rows[0]
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' })

  const id = randomUUID()
  const password_hash = await bcrypt.hash(password, 10)
  await pool.query(
    'INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, name.trim(), email.toLowerCase().trim(), password_hash, new Date().toISOString()]
  )
  const user = { id, name: name.trim(), email: email.toLowerCase().trim() }
  res.json({ token: signToken(user), user })
})

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })

  const user = (await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()])).rows[0]
  if (!user) return res.status(401).json({ error: 'No account found with this email.' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Incorrect password.' })

  const payload = { id: user.id, name: user.name, email: user.email }
  res.json({ token: signToken(payload), user: payload })
})

app.get('/auth/me', requireAuth, async (req, res) => {
  const user = (await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id])).rows[0]
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const teams = (await pool.query(`
    SELECT t.id, t.name, t.invite_token, tm.role, tm.joined_at
    FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = $1 ORDER BY tm.joined_at ASC
  `, [req.user.id])).rows

  res.json({ user, teams })
})

// ─── Team routes ────────────────────────────────────────────────────────────

app.post('/teams', requireAuth, async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Team name is required.' })

  const id = randomUUID()
  const invite_token = randomUUID()
  const now = new Date().toISOString()

  await pool.query('INSERT INTO teams (id, name, invite_token, created_at) VALUES ($1, $2, $3, $4)', [id, name.trim(), invite_token, now])
  await pool.query('INSERT INTO team_members (user_id, team_id, role, joined_at) VALUES ($1, $2, $3, $4)', [req.user.id, id, 'admin', now])

  res.json({ id, name: name.trim(), invite_token, role: 'admin' })
})

app.get('/teams/:id', requireAuth, async (req, res) => {
  const member = (await pool.query('SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2', [req.user.id, req.params.id])).rows[0]
  if (!member) return res.status(403).json({ error: 'Not a member.' })

  const team = (await pool.query('SELECT id, name, invite_token, created_at FROM teams WHERE id = $1', [req.params.id])).rows[0]
  if (!team) return res.status(404).json({ error: 'Team not found.' })

  const members = (await pool.query(`
    SELECT u.id, u.name, u.email, tm.role, tm.joined_at
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = $1 ORDER BY tm.joined_at ASC
  `, [req.params.id])).rows

  res.json({ ...team, members, my_role: member.role })
})

app.post('/teams/join/:token', requireAuth, async (req, res) => {
  const team = (await pool.query('SELECT * FROM teams WHERE invite_token = $1', [req.params.token])).rows[0]
  if (!team) return res.status(404).json({ error: 'Invalid or expired invite link.' })

  const already = (await pool.query('SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2', [req.user.id, team.id])).rows[0]
  if (already) return res.status(200).json({ id: team.id, name: team.name, already: true })

  await pool.query('INSERT INTO team_members (user_id, team_id, role, joined_at) VALUES ($1, $2, $3, $4)', [req.user.id, team.id, 'member', new Date().toISOString()])
  res.json({ id: team.id, name: team.name, role: 'member' })
})

app.post('/teams/:id/invite/regenerate', requireAuth, async (req, res) => {
  const member = (await pool.query('SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2', [req.user.id, req.params.id])).rows[0]
  if (!member || member.role !== 'admin') return res.status(403).json({ error: 'Admin only.' })

  const invite_token = randomUUID()
  await pool.query('UPDATE teams SET invite_token = $1 WHERE id = $2', [invite_token, req.params.id])
  res.json({ invite_token })
})

app.patch('/teams/:id/members/:userId', requireAuth, async (req, res) => {
  const me = (await pool.query('SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2', [req.user.id, req.params.id])).rows[0]
  if (!me || me.role !== 'admin') return res.status(403).json({ error: 'Admin only.' })
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot change your own role.' })

  const { role } = req.body
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member.' })

  const result = await pool.query('UPDATE team_members SET role = $1 WHERE user_id = $2 AND team_id = $3', [role, req.params.userId, req.params.id])
  if (!result.rowCount) return res.status(404).json({ error: 'Member not found.' })
  res.json({ ok: true })
})

app.delete('/teams/:id/members/:userId', requireAuth, async (req, res) => {
  const me = (await pool.query('SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2', [req.user.id, req.params.id])).rows[0]
  if (!me) return res.status(403).json({ error: 'Not a member.' })

  const isSelf = req.params.userId === req.user.id
  if (!isSelf && me.role !== 'admin') return res.status(403).json({ error: 'Admin only.' })

  if (isSelf && me.role === 'admin') {
    const { rows } = await pool.query("SELECT COUNT(*)::int as n FROM team_members WHERE team_id = $1 AND role = 'admin'", [req.params.id])
    if (rows[0].n <= 1) return res.status(400).json({ error: 'Assign another admin before leaving.' })
  }

  await pool.query('DELETE FROM team_members WHERE user_id = $1 AND team_id = $2', [req.params.userId, req.params.id])
  res.json({ ok: true })
})

// ─── Data routes (all scoped to team) ───────────────────────────────────────

app.post('/analyze-transcript', requireAuth, requireTeam, async (req, res) => {
  const { transcript, title, date } = req.body
  if (!transcript?.trim()) return res.status(400).json({ error: 'transcript is required' })

  const normalized = preprocessTranscript(transcript.trim())
  const speakers = Array.isArray(req.body.speakers) && req.body.speakers.length > 0
    ? req.body.speakers.map(s => s.trim()).filter(Boolean)
    : extractSpeakers(normalized)

  let rawText = ''
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(buildPrompt(normalized, speakers))
    rawText = result.response.text().trim()
  } catch (err) {
    console.error('Gemini error:', err.message, err.status, err.errorDetails)
    return res.status(502).json({ error: 'Failed to call LLM', details: err.message })
  }

  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed
  try { parsed = JSON.parse(cleaned) }
  catch { parsed = { summary: [rawText], decisions: [], action_items: [], pain_points: [], person_wise: {} } }

  // Normalize action_items: AI sometimes returns [{Name, action}] instead of ["string"]
  if (Array.isArray(parsed.action_items)) {
    parsed.action_items = parsed.action_items.map(item =>
      typeof item === 'string' ? item : `${item.Name ?? item.name ?? ''}: ${item.action ?? item.Action ?? ''}`.replace(/^:\s*/, '').trim()
    ).filter(Boolean)
  }

  const pw = parsed.person_wise ?? {}
  for (const name of speakers) { if (!(name in pw)) pw[name] = [] }
  parsed.person_wise = pw

  const id = randomUUID()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO meetings (id, team_id, title, date, transcript, summary, decisions, action_items, pain_points, person_wise, speakers, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id, req.teamId, title?.trim() || 'Untitled Meeting', date || new Date().toISOString().slice(0, 10),
        normalized, JSON.stringify(parsed.summary ?? []), JSON.stringify(parsed.decisions ?? []),
        JSON.stringify(parsed.action_items ?? []), JSON.stringify(parsed.pain_points ?? []),
        JSON.stringify(parsed.person_wise ?? {}), JSON.stringify(speakers), new Date().toISOString()]
    )
    for (const name of speakers) {
      await client.query('INSERT INTO participants (meeting_id, name) VALUES ($1, $2)', [id, name])
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return res.json({ id, summary: parsed.summary ?? [], decisions: parsed.decisions ?? [], action_items: parsed.action_items ?? [], pain_points: parsed.pain_points ?? [], person_wise: parsed.person_wise ?? {}, speakers })
})

app.get('/stats', requireAuth, requireTeam, async (req, res) => {
  const tid = req.teamId
  const [{ rows: [tm] }, { rows: [up] }, { rows: [mm] }] = await Promise.all([
    pool.query('SELECT COUNT(*)::int as n FROM meetings WHERE team_id = $1', [tid]),
    pool.query('SELECT COUNT(DISTINCT p.name)::int as n FROM participants p JOIN meetings m ON m.id = p.meeting_id WHERE m.team_id = $1', [tid]),
    pool.query("SELECT COUNT(*)::int as n FROM meetings WHERE team_id = $1 AND date LIKE $2", [tid, `${new Date().toISOString().slice(0, 7)}%`]),
  ])
  res.json({ totalMeetings: tm.n, uniqueParticipants: up.n, thisMonth: mm.n })
})

app.get('/meetings', requireAuth, requireTeam, async (req, res) => {
  const { q, filter } = req.query
  const tid = req.teamId
  const cols = 'id, title, date, summary, speakers, created_at'
  const base = `SELECT ${cols} FROM meetings WHERE team_id = $1`

  let rows
  if (!q?.trim() || !filter || filter === 'all') {
    rows = (await pool.query(`${base} ORDER BY date DESC, created_at DESC LIMIT 200`, [tid])).rows
  } else if (filter === 'participant') {
    rows = (await pool.query(`
      SELECT DISTINCT m.id, m.title, m.date, m.summary, m.speakers, m.created_at
      FROM meetings m JOIN participants p ON p.meeting_id = m.id
      WHERE m.team_id = $1 AND p.name ILIKE $2
      ORDER BY m.date DESC, m.created_at DESC LIMIT 200
    `, [tid, `%${q}%`])).rows
  } else if (filter === 'date') {
    rows = (await pool.query(`${base} AND date LIKE $2 ORDER BY date DESC LIMIT 200`, [tid, `${q}%`])).rows
  } else {
    rows = (await pool.query(`${base} AND title ILIKE $2 ORDER BY date DESC LIMIT 200`, [tid, `%${q}%`])).rows
  }

  res.json(rows.map(r => ({ ...r, summary: JSON.parse(r.summary), speakers: JSON.parse(r.speakers) })))
})

app.get('/meetings/:id', requireAuth, requireTeam, async (req, res) => {
  const m = (await pool.query('SELECT * FROM meetings WHERE id = $1 AND team_id = $2', [req.params.id, req.teamId])).rows[0]
  if (!m) return res.status(404).json({ error: 'Not found' })
  res.json({ ...m, summary: JSON.parse(m.summary), decisions: JSON.parse(m.decisions), action_items: JSON.parse(m.action_items), pain_points: JSON.parse(m.pain_points || '[]'), person_wise: JSON.parse(m.person_wise), speakers: JSON.parse(m.speakers) })
})

app.patch('/meetings/:id', requireAuth, requireTeam, async (req, res) => {
  const { person_wise, summary, decisions, action_items, pain_points, title, date, speakers } = req.body
  const sets = []; const vals = []; let p = 1
  if (person_wise && typeof person_wise === 'object') { sets.push(`person_wise = $${p++}`); vals.push(JSON.stringify(person_wise)) }
  if (Array.isArray(summary)) { sets.push(`summary = $${p++}`); vals.push(JSON.stringify(summary)) }
  if (Array.isArray(decisions)) { sets.push(`decisions = $${p++}`); vals.push(JSON.stringify(decisions)) }
  if (Array.isArray(action_items)) { sets.push(`action_items = $${p++}`); vals.push(JSON.stringify(action_items)) }
  if (Array.isArray(pain_points)) { sets.push(`pain_points = $${p++}`); vals.push(JSON.stringify(pain_points)) }
  if (typeof title === 'string' && title.trim()) { sets.push(`title = $${p++}`); vals.push(title.trim()) }
  if (typeof date === 'string' && date) { sets.push(`date = $${p++}`); vals.push(date) }
  if (Array.isArray(speakers) && speakers.length) { sets.push(`speakers = $${p++}`); vals.push(JSON.stringify(speakers)) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  vals.push(req.params.id, req.teamId)
  const result = await pool.query(`UPDATE meetings SET ${sets.join(', ')} WHERE id = $${p} AND team_id = $${p + 1}`, vals)
  if (!result.rowCount) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.delete('/meetings/:id', requireAuth, requireTeam, async (req, res) => {
  const result = await pool.query('DELETE FROM meetings WHERE id = $1 AND team_id = $2', [req.params.id, req.teamId])
  if (!result.rowCount) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

// Normalize a raw name: strip email domain, trim
function normName(raw) {
  const s = (raw || '').trim()
  return s.includes('@') ? s.split('@')[0].trim() : s
}

// Merge names that are substrings of each other — shorter collapses into longer
// e.g. "Tanveer" + "Tanveer Mujawar" → both become "Tanveer Mujawar"
function buildCanonicalMap(names) {
  const sorted = [...new Set(names)].sort((a, b) => b.length - a.length)
  const canon = {}
  for (const name of sorted) {
    const lower = name.toLowerCase()
    const parent = sorted.find(other => {
      if (other === name) return false
      const ol = other.toLowerCase()
      return ol.includes(lower) || lower.includes(ol)
    })
    canon[name] = parent ?? name
  }
  // flatten transitive chains
  for (const k of Object.keys(canon)) {
    let v = canon[k]
    while (canon[v] && canon[v] !== v) v = canon[v]
    canon[k] = v
  }
  return canon
}

function mergeNameCounts(raw) {
  // raw: [{name, count/meetings}]
  const valueKey = raw[0] && 'meetings' in raw[0] ? 'meetings' : 'count'
  const normed = raw.map(r => ({ name: normName(r.name), val: r[valueKey] }))
  const allNames = normed.map(r => r.name)
  const canon = buildCanonicalMap(allNames)
  const merged = {}
  for (const { name, val } of normed) {
    const c = canon[name] ?? name
    merged[c] = (merged[c] ?? 0) + val
  }
  return Object.entries(merged)
    .map(([name, v]) => ({ name, [valueKey]: v }))
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, 20)
}

app.get('/analytics', requireAuth, requireTeam, async (req, res) => {
  const tid = req.teamId
  const [byDateRes, byParticipantRes, pwRes] = await Promise.all([
    pool.query('SELECT date, COUNT(*)::int as count FROM meetings WHERE team_id = $1 GROUP BY date ORDER BY date ASC', [tid]),
    pool.query('SELECT p.name, COUNT(*)::int as meetings FROM participants p JOIN meetings m ON m.id = p.meeting_id WHERE m.team_id = $1 GROUP BY p.name ORDER BY meetings DESC LIMIT 100', [tid]),
    pool.query('SELECT person_wise FROM meetings WHERE team_id = $1', [tid]),
  ])
  const actionMap = {}
  for (const row of pwRes.rows) {
    for (const [name, items] of Object.entries(JSON.parse(row.person_wise))) {
      if (name === 'Unassigned') continue
      const n = normName(name)
      actionMap[n] = (actionMap[n] ?? 0) + (items?.length ?? 0)
    }
  }
  const rawActions = Object.entries(actionMap).map(([name, count]) => ({ name, count }))
  const byParticipant = mergeNameCounts(byParticipantRes.rows)
  const allNames = byParticipant.map(r => r.name)
  const canon = buildCanonicalMap(allNames)
  const mergedActions = {}
  for (const { name, count } of rawActions) {
    const c = canon[name] ?? name
    mergedActions[c] = (mergedActions[c] ?? 0) + count
  }
  const byActions = Object.entries(mergedActions)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
  res.json({ byDate: byDateRes.rows, byParticipant, byActions })
})

app.post('/team-summary', requireAuth, requireTeam, async (req, res) => {
  const { meeting_ids, date_from, date_to } = req.body ?? {}
  const tid = req.teamId
  const cols = 'id, title, date, summary, decisions, action_items, person_wise'
  let meetings

  if (Array.isArray(meeting_ids) && meeting_ids.length > 0) {
    const ph = meeting_ids.map((_, i) => `$${i + 2}`).join(',')
    meetings = (await pool.query(`SELECT ${cols} FROM meetings WHERE team_id = $1 AND id IN (${ph}) ORDER BY date ASC`, [tid, ...meeting_ids])).rows
  } else if (date_from || date_to) {
    meetings = (await pool.query(`SELECT ${cols} FROM meetings WHERE team_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date ASC`, [tid, date_from || '0000-01-01', date_to || '9999-12-31'])).rows
  } else {
    meetings = (await pool.query(`SELECT ${cols} FROM meetings WHERE team_id = $1 ORDER BY date ASC`, [tid])).rows
  }

  if (meetings.length === 0) return res.status(400).json({ error: 'No meetings found for the selected criteria.' })

  const digest = meetings.map(m => {
    const pw = JSON.parse(m.person_wise)
    const pwLines = Object.entries(pw).filter(([n]) => n !== 'Unassigned').map(([n, items]) => `  ${n}: ${items.join(' | ')}`).join('\n')
    return `--- "${m.title}" (${m.date}) ---\nSummary: ${JSON.parse(m.summary).join(' | ')}\nDecisions: ${JSON.parse(m.decisions).join(' | ')}\nAction Items: ${JSON.parse(m.action_items).join(' | ')}\nPerson-wise:\n${pwLines || '  (none)'}`
  }).join('\n\n')

  const prompt = `You are an executive analyst reviewing all meetings from a team.\n\nBelow is data from ${meetings.length} meeting(s) spanning ${meetings[0].date} to ${meetings[meetings.length - 1].date}.\n\n${digest}\n\nGenerate a comprehensive team summary. Respond ONLY in this exact JSON format (no markdown fences):\n\n{"overview":["bullet"],"themes":["theme"],"decisions":["decision"],"open_actions":{"Person":["action"]},"recommendations":["rec"]}\n\nRules:\n- "overview": 5 high-level bullets\n- "themes": 3–5 recurring topics\n- "decisions": all important decisions (no duplicates)\n- "open_actions": combined person-wise actions across all meetings (merge same person)\n- "recommendations": 2–3 actionable suggestions`

  let rawText = ''
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    rawText = (await model.generateContent(prompt)).response.text().trim()
  } catch (err) {
    return res.status(502).json({ error: 'Failed to call LLM', details: err.message })
  }

  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed
  try { parsed = JSON.parse(cleaned) }
  catch { return res.status(200).json({ overview: [rawText], themes: [], decisions: [], open_actions: {}, recommendations: [], _raw: true }) }

  return res.json({ overview: parsed.overview ?? [], themes: parsed.themes ?? [], decisions: parsed.decisions ?? [], open_actions: parsed.open_actions ?? {}, recommendations: parsed.recommendations ?? [], meeting_count: meetings.length, meeting_ids: meetings.map(m => m.id), date_range: `${meetings[0].date} → ${meetings[meetings.length - 1].date}` })
})

app.post('/ask-ai', requireAuth, requireTeam, async (req, res) => {
  const { question, meeting_ids, history = [] } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' })
  const tid = req.teamId

  let rows
  let includeTranscript = false
  if (Array.isArray(meeting_ids) && meeting_ids.length > 0) {
    // Specific meetings selected — include full transcripts for deeper answers
    const ph = meeting_ids.map((_, i) => `$${i + 2}`).join(',')
    rows = (await pool.query(`SELECT * FROM meetings WHERE team_id = $1 AND id IN (${ph})`, [tid, ...meeting_ids])).rows
    includeTranscript = meeting_ids.length <= 5
  } else {
    // All meetings — use summaries only (no transcripts) to fit all meetings in context
    const COLS = 'id, title, date, speakers, summary, decisions, action_items, pain_points, person_wise'
    rows = (await pool.query(`SELECT ${COLS} FROM meetings WHERE team_id = $1 ORDER BY date DESC`, [tid])).rows
  }

  if (rows.length === 0) return res.status(400).json({ error: 'No meetings selected.' })

  const context = rows.map(m => {
    const pwLines = Object.entries(JSON.parse(m.person_wise)).map(([n, items]) => `  ${n}: ${items.join('; ')}`).join('\n')
    const base = `=== "${m.title}" (${m.date}) ===\nParticipants: ${JSON.parse(m.speakers).join(', ')}\nSummary: ${JSON.parse(m.summary).join(' | ') || 'N/A'}\nDecisions: ${JSON.parse(m.decisions).join(' | ') || 'N/A'}\nAction Items: ${JSON.parse(m.action_items).join(' | ') || 'N/A'}\nPain Points: ${JSON.parse(m.pain_points || '[]').join(' | ') || 'N/A'}\nPerson-wise:\n${pwLines || '  (none)'}`
    return includeTranscript ? `${base}\nFull Transcript:\n${m.transcript}` : base
  }).join('\n\n')

  const historyText = history.length > 0 ? '\n\nPrior conversation:\n' + history.map(h => `${h.role === 'user' ? 'Q' : 'A'}: ${h.content}`).join('\n') : ''

  const prompt = `You are a sharp, senior business advisor who has just sat through these meetings and knows them inside out. You're now having a live, candid conversation with a colleague — not writing a report. Talk like a trusted expert across the table: direct, confident, occasionally opinionated, and always grounded in what actually happened in the meetings.

Your tone:
- Conversational and warm, but authoritative — like a seasoned consultant who gets straight to the point
- No corporate fluff, no unnecessary hedging
- Lead with the most important insight, then back it up
- Use bullet points ONLY when listing genuinely distinct items (3+); for everything else, just talk
- Name names, cite specifics from the transcript, call out patterns honestly
- If something is a red flag or a risk, say so plainly
- If you have a strong opinion based on the data, share it — don't just describe, interpret
- Match the length to the question: a simple question gets 2-3 sentences, a complex one gets a real answer

Meeting Data:\n${context}${historyText}

Question: ${question.trim()}

Respond as if you're mid-conversation — no "Certainly!" or "Great question!", just dive straight into the answer.`

  let answer = ''
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    answer = (await model.generateContent(prompt)).response.text().trim()
  } catch (err) {
    return res.status(502).json({ error: 'Failed to call LLM', details: err.message })
  }

  res.json({ answer, meeting_count: rows.length })
})

// ─── AI Sessions ─────────────────────────────────────────────────────────────

app.get('/ai-sessions', requireAuth, requireTeam, async (req, res) => {
  const sessions = (await pool.query(
    'SELECT id, title, meeting_ids, created_at, updated_at, jsonb_array_length(messages::jsonb) as message_count FROM ai_sessions WHERE team_id = $1 ORDER BY updated_at DESC',
    [req.teamId]
  )).rows
  res.json(sessions.map(s => ({ ...s, meeting_ids: JSON.parse(s.meeting_ids), message_count: parseInt(s.message_count ?? 0) })))
})

app.post('/ai-sessions', requireAuth, requireTeam, async (req, res) => {
  const { title = 'New Chat', meeting_ids = [], messages = [] } = req.body
  const id = randomUUID(); const now = new Date().toISOString()
  await pool.query(
    'INSERT INTO ai_sessions (id, team_id, title, messages, meeting_ids, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, req.teamId, title, JSON.stringify(messages), JSON.stringify(meeting_ids), now, now]
  )
  res.json({ id, title, messages, meeting_ids, created_at: now, updated_at: now })
})

app.get('/ai-sessions/:id', requireAuth, requireTeam, async (req, res) => {
  const s = (await pool.query('SELECT * FROM ai_sessions WHERE id = $1 AND team_id = $2', [req.params.id, req.teamId])).rows[0]
  if (!s) return res.status(404).json({ error: 'Not found' })
  res.json({ ...s, messages: JSON.parse(s.messages), meeting_ids: JSON.parse(s.meeting_ids) })
})

app.patch('/ai-sessions/:id', requireAuth, requireTeam, async (req, res) => {
  const { messages, meeting_ids, title } = req.body
  const sets = []; const vals = []; let p = 1
  if (Array.isArray(messages)) { sets.push(`messages = $${p++}`); vals.push(JSON.stringify(messages)) }
  if (Array.isArray(meeting_ids)) { sets.push(`meeting_ids = $${p++}`); vals.push(JSON.stringify(meeting_ids)) }
  if (typeof title === 'string') { sets.push(`title = $${p++}`); vals.push(title) }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
  sets.push(`updated_at = $${p++}`); vals.push(new Date().toISOString())
  vals.push(req.params.id, req.teamId)
  const result = await pool.query(`UPDATE ai_sessions SET ${sets.join(', ')} WHERE id = $${p} AND team_id = $${p + 1}`, vals)
  if (!result.rowCount) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.delete('/ai-sessions/:id', requireAuth, requireTeam, async (req, res) => {
  const result = await pool.query('DELETE FROM ai_sessions WHERE id = $1 AND team_id = $2', [req.params.id, req.teamId])
  if (!result.rowCount) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

// Global error handler — ensures every crash returns JSON, never an empty body
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// ─── Local dev server ────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5001
  dbReady.then(err => {
    if (err instanceof Error) { console.error('DB init failed:', err.message, err.code, err.detail); process.exit(1) }
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
}

export default app
