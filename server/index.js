import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import db from './db.js'
import { signToken, requireAuth, requireTeam } from './auth.js'

dotenv.config()

const app = express()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'Meeting Intelligence API' }))

// ─── Transcript helpers ────────────────────────────────────────────────────────

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

// ─── Auth routes ───────────────────────────────────────────────────────────────

app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'name, email and password are required.' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim())
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' })

  const id = randomUUID()
  const password_hash = await bcrypt.hash(password, 10)
  db.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name.trim(), email.toLowerCase().trim(), password_hash, new Date().toISOString())

  const user = { id, name: name.trim(), email: email.toLowerCase().trim() }
  res.json({ token: signToken(user), user })
})

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
  if (!user) return res.status(401).json({ error: 'No account found with this email.' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Incorrect password.' })

  const payload = { id: user.id, name: user.name, email: user.email }
  res.json({ token: signToken(payload), user: payload })
})

app.get('/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const teams = db.prepare(`
    SELECT t.id, t.name, t.invite_token, tm.role, tm.joined_at
    FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ?
    ORDER BY tm.joined_at ASC
  `).all(req.user.id)

  res.json({ user, teams })
})

// ─── Team routes ───────────────────────────────────────────────────────────────

app.post('/teams', requireAuth, (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Team name is required.' })

  const id = randomUUID()
  const invite_token = randomUUID()
  const now = new Date().toISOString()

  db.prepare('INSERT INTO teams (id, name, invite_token, created_at) VALUES (?, ?, ?, ?)').run(id, name.trim(), invite_token, now)
  db.prepare('INSERT INTO team_members (user_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)').run(req.user.id, id, 'admin', now)

  res.json({ id, name: name.trim(), invite_token, role: 'admin' })
})

// Get team info + members (must be a member)
app.get('/teams/:id', requireAuth, (req, res) => {
  const member = db.prepare('SELECT role FROM team_members WHERE user_id = ? AND team_id = ?').get(req.user.id, req.params.id)
  if (!member) return res.status(403).json({ error: 'Not a member.' })

  const team = db.prepare('SELECT id, name, invite_token, created_at FROM teams WHERE id = ?').get(req.params.id)
  if (!team) return res.status(404).json({ error: 'Team not found.' })

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, tm.role, tm.joined_at
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ? ORDER BY tm.joined_at ASC
  `).all(req.params.id)

  res.json({ ...team, members, my_role: member.role })
})

// Join via invite token
app.post('/teams/join/:token', requireAuth, (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE invite_token = ?').get(req.params.token)
  if (!team) return res.status(404).json({ error: 'Invalid or expired invite link.' })

  const already = db.prepare('SELECT id FROM team_members WHERE user_id = ? AND team_id = ?').get(req.user.id, team.id)
  if (already) return res.status(200).json({ id: team.id, name: team.name, already: true })

  db.prepare('INSERT INTO team_members (user_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)').run(req.user.id, team.id, 'member', new Date().toISOString())
  res.json({ id: team.id, name: team.name, role: 'member' })
})

// Regenerate invite token (admin only)
app.post('/teams/:id/invite/regenerate', requireAuth, (req, res) => {
  const member = db.prepare('SELECT role FROM team_members WHERE user_id = ? AND team_id = ?').get(req.user.id, req.params.id)
  if (!member || member.role !== 'admin') return res.status(403).json({ error: 'Admin only.' })

  const invite_token = randomUUID()
  db.prepare('UPDATE teams SET invite_token = ? WHERE id = ?').run(invite_token, req.params.id)
  res.json({ invite_token })
})

// Update member role (admin only)
app.patch('/teams/:id/members/:userId', requireAuth, (req, res) => {
  const me = db.prepare('SELECT role FROM team_members WHERE user_id = ? AND team_id = ?').get(req.user.id, req.params.id)
  if (!me || me.role !== 'admin') return res.status(403).json({ error: 'Admin only.' })
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot change your own role.' })

  const { role } = req.body
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member.' })

  const { changes } = db.prepare('UPDATE team_members SET role = ? WHERE user_id = ? AND team_id = ?').run(role, req.params.userId, req.params.id)
  if (!changes) return res.status(404).json({ error: 'Member not found.' })
  res.json({ ok: true })
})

// Remove member (admin only, or self-leave)
app.delete('/teams/:id/members/:userId', requireAuth, (req, res) => {
  const me = db.prepare('SELECT role FROM team_members WHERE user_id = ? AND team_id = ?').get(req.user.id, req.params.id)
  if (!me) return res.status(403).json({ error: 'Not a member.' })

  const isSelf = req.params.userId === req.user.id
  if (!isSelf && me.role !== 'admin') return res.status(403).json({ error: 'Admin only.' })

  // Prevent last admin from leaving
  if (isSelf && me.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as n FROM team_members WHERE team_id = ? AND role = 'admin'").get(req.params.id).n
    if (adminCount <= 1) return res.status(400).json({ error: 'Assign another admin before leaving.' })
  }

  db.prepare('DELETE FROM team_members WHERE user_id = ? AND team_id = ?').run(req.params.userId, req.params.id)
  res.json({ ok: true })
})

// ─── Data routes (all scoped to team) ─────────────────────────────────────────

const insertMeeting = db.prepare(`
  INSERT INTO meetings (id, team_id, title, date, transcript, summary, decisions, action_items, pain_points, person_wise, speakers, created_at)
  VALUES (@id, @team_id, @title, @date, @transcript, @summary, @decisions, @action_items, @pain_points, @person_wise, @speakers, @created_at)
`)
const insertParticipant = db.prepare('INSERT INTO participants (meeting_id, name) VALUES (?, ?)')
const saveMeeting = db.transaction((row, speakers) => {
  insertMeeting.run(row)
  for (const name of speakers) insertParticipant.run(row.id, name)
})

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
    console.error('Gemini error:', err.message)
    return res.status(502).json({ error: 'Failed to call LLM', details: err.message })
  }

  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed
  try { parsed = JSON.parse(cleaned) }
  catch { parsed = { summary: [rawText], decisions: [], action_items: [], pain_points: [], person_wise: {} } }

  const pw = parsed.person_wise ?? {}
  for (const name of speakers) { if (!(name in pw)) pw[name] = [] }
  parsed.person_wise = pw

  const id = randomUUID()
  saveMeeting({
    id, team_id: req.teamId,
    title: title?.trim() || 'Untitled Meeting',
    date: date || new Date().toISOString().slice(0, 10),
    transcript: normalized,
    summary: JSON.stringify(parsed.summary ?? []),
    decisions: JSON.stringify(parsed.decisions ?? []),
    action_items: JSON.stringify(parsed.action_items ?? []),
    pain_points: JSON.stringify(parsed.pain_points ?? []),
    person_wise: JSON.stringify(parsed.person_wise ?? {}),
    speakers: JSON.stringify(speakers),
    created_at: new Date().toISOString(),
  }, speakers)

  return res.json({ id, summary: parsed.summary ?? [], decisions: parsed.decisions ?? [], action_items: parsed.action_items ?? [], pain_points: parsed.pain_points ?? [], person_wise: parsed.person_wise ?? {}, speakers })
})

app.get('/stats', requireAuth, requireTeam, (_req, res) => {
  const tid = _req.teamId
  const totalMeetings = db.prepare('SELECT COUNT(*) as n FROM meetings WHERE team_id = ?').get(tid).n
  const uniqueParticipants = db.prepare('SELECT COUNT(DISTINCT p.name) as n FROM participants p JOIN meetings m ON m.id = p.meeting_id WHERE m.team_id = ?').get(tid).n
  const ym = new Date().toISOString().slice(0, 7)
  const thisMonth = db.prepare("SELECT COUNT(*) as n FROM meetings WHERE team_id = ? AND date LIKE ?").get(tid, `${ym}%`).n
  res.json({ totalMeetings, uniqueParticipants, thisMonth })
})

app.get('/meetings', requireAuth, requireTeam, (req, res) => {
  const { q, filter } = req.query
  const tid = req.teamId
  const cols = 'id, title, date, summary, speakers, created_at'
  const base = `SELECT ${cols} FROM meetings WHERE team_id = ?`

  let rows
  if (!q?.trim() || !filter || filter === 'all') {
    rows = db.prepare(`${base} ORDER BY date DESC, created_at DESC LIMIT 200`).all(tid)
  } else if (filter === 'participant') {
    rows = db.prepare(`
      SELECT DISTINCT m.${cols.split(', ').join(', m.')}
      FROM meetings m JOIN participants p ON p.meeting_id = m.id
      WHERE m.team_id = ? AND p.name LIKE ?
      ORDER BY m.date DESC, m.created_at DESC LIMIT 200
    `).all(tid, `%${q}%`)
  } else if (filter === 'date') {
    rows = db.prepare(`${base} AND date LIKE ? ORDER BY date DESC LIMIT 200`).all(tid, `${q}%`)
  } else {
    rows = db.prepare(`${base} AND title LIKE ? ORDER BY date DESC LIMIT 200`).all(tid, `%${q}%`)
  }

  res.json(rows.map(r => ({ ...r, summary: JSON.parse(r.summary), speakers: JSON.parse(r.speakers) })))
})

app.get('/meetings/:id', requireAuth, requireTeam, (req, res) => {
  const m = db.prepare('SELECT * FROM meetings WHERE id = ? AND team_id = ?').get(req.params.id, req.teamId)
  if (!m) return res.status(404).json({ error: 'Not found' })
  res.json({ ...m, summary: JSON.parse(m.summary), decisions: JSON.parse(m.decisions), action_items: JSON.parse(m.action_items), pain_points: JSON.parse(m.pain_points || '[]'), person_wise: JSON.parse(m.person_wise), speakers: JSON.parse(m.speakers) })
})

app.patch('/meetings/:id', requireAuth, requireTeam, (req, res) => {
  const { person_wise, summary, decisions, action_items, pain_points } = req.body
  const setClauses = []; const values = []
  if (person_wise && typeof person_wise === 'object') { setClauses.push('person_wise = ?'); values.push(JSON.stringify(person_wise)) }
  if (Array.isArray(summary)) { setClauses.push('summary = ?'); values.push(JSON.stringify(summary)) }
  if (Array.isArray(decisions)) { setClauses.push('decisions = ?'); values.push(JSON.stringify(decisions)) }
  if (Array.isArray(action_items)) { setClauses.push('action_items = ?'); values.push(JSON.stringify(action_items)) }
  if (Array.isArray(pain_points)) { setClauses.push('pain_points = ?'); values.push(JSON.stringify(pain_points)) }
  if (setClauses.length === 0) return res.status(400).json({ error: 'Nothing to update' })
  values.push(req.params.id, req.teamId)
  const { changes } = db.prepare(`UPDATE meetings SET ${setClauses.join(', ')} WHERE id = ? AND team_id = ?`).run(...values)
  if (!changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.delete('/meetings/:id', requireAuth, requireTeam, (req, res) => {
  const { changes } = db.prepare('DELETE FROM meetings WHERE id = ? AND team_id = ?').run(req.params.id, req.teamId)
  if (!changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.get('/analytics', requireAuth, requireTeam, (req, res) => {
  const tid = req.teamId
  const byDate = db.prepare('SELECT date, COUNT(*) as count FROM meetings WHERE team_id = ? GROUP BY date ORDER BY date ASC').all(tid)
  const byParticipant = db.prepare('SELECT p.name, COUNT(*) as meetings FROM participants p JOIN meetings m ON m.id = p.meeting_id WHERE m.team_id = ? GROUP BY p.name ORDER BY meetings DESC LIMIT 20').all(tid)
  const rows = db.prepare('SELECT person_wise FROM meetings WHERE team_id = ?').all(tid)
  const actionMap = {}
  for (const row of rows) {
    for (const [name, items] of Object.entries(JSON.parse(row.person_wise))) {
      if (name === 'Unassigned') continue
      actionMap[name] = (actionMap[name] ?? 0) + (items?.length ?? 0)
    }
  }
  const byActions = Object.entries(actionMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20)
  res.json({ byDate, byParticipant, byActions })
})

app.post('/team-summary', requireAuth, requireTeam, async (req, res) => {
  const { meeting_ids, date_from, date_to } = req.body ?? {}
  const tid = req.teamId
  let meetings

  if (Array.isArray(meeting_ids) && meeting_ids.length > 0) {
    const ph = meeting_ids.map(() => '?').join(',')
    meetings = db.prepare(`SELECT id, title, date, summary, decisions, action_items, person_wise FROM meetings WHERE team_id = ? AND id IN (${ph}) ORDER BY date ASC`).all(tid, ...meeting_ids)
  } else if (date_from || date_to) {
    meetings = db.prepare('SELECT id, title, date, summary, decisions, action_items, person_wise FROM meetings WHERE team_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC').all(tid, date_from || '0000-01-01', date_to || '9999-12-31')
  } else {
    meetings = db.prepare('SELECT id, title, date, summary, decisions, action_items, person_wise FROM meetings WHERE team_id = ? ORDER BY date ASC').all(tid)
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
  if (Array.isArray(meeting_ids) && meeting_ids.length > 0) {
    const ph = meeting_ids.map(() => '?').join(',')
    rows = db.prepare(`SELECT * FROM meetings WHERE team_id = ? AND id IN (${ph})`).all(tid, ...meeting_ids)
  } else {
    rows = db.prepare('SELECT * FROM meetings WHERE team_id = ? ORDER BY date DESC').all(tid)
  }

  if (rows.length === 0) return res.status(400).json({ error: 'No meetings selected.' })

  const context = rows.map(m => {
    const pwLines = Object.entries(JSON.parse(m.person_wise)).map(([n, items]) => `  ${n}: ${items.join('; ')}`).join('\n')
    return `=== "${m.title}" (${m.date}) ===\nParticipants: ${JSON.parse(m.speakers).join(', ')}\nSummary: ${JSON.parse(m.summary).join(' | ') || 'N/A'}\nDecisions: ${JSON.parse(m.decisions).join(' | ') || 'N/A'}\nAction Items: ${JSON.parse(m.action_items).join(' | ') || 'N/A'}\nPain Points: ${JSON.parse(m.pain_points || '[]').join(' | ') || 'N/A'}\nPerson-wise:\n${pwLines || '  (none)'}\nFull Transcript:\n${m.transcript}`
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

// ─── AI Sessions ──────────────────────────────────────────────────────────────

app.get('/ai-sessions', requireAuth, requireTeam, (req, res) => {
  const sessions = db.prepare('SELECT id, title, meeting_ids, created_at, updated_at, json_array_length(messages) as message_count FROM ai_sessions WHERE team_id = ? ORDER BY updated_at DESC').all(req.teamId)
  res.json(sessions.map(s => ({ ...s, meeting_ids: JSON.parse(s.meeting_ids) })))
})

app.post('/ai-sessions', requireAuth, requireTeam, (req, res) => {
  const { title = 'New Chat', meeting_ids = [], messages = [] } = req.body
  const id = randomUUID(); const now = new Date().toISOString()
  db.prepare('INSERT INTO ai_sessions (id, team_id, title, messages, meeting_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, req.teamId, title, JSON.stringify(messages), JSON.stringify(meeting_ids), now, now)
  res.json({ id, title, messages, meeting_ids, created_at: now, updated_at: now })
})

app.get('/ai-sessions/:id', requireAuth, requireTeam, (req, res) => {
  const s = db.prepare('SELECT * FROM ai_sessions WHERE id = ? AND team_id = ?').get(req.params.id, req.teamId)
  if (!s) return res.status(404).json({ error: 'Not found' })
  res.json({ ...s, messages: JSON.parse(s.messages), meeting_ids: JSON.parse(s.meeting_ids) })
})

app.patch('/ai-sessions/:id', requireAuth, requireTeam, (req, res) => {
  const { messages, meeting_ids, title } = req.body
  const setClauses = []; const values = []
  if (Array.isArray(messages)) { setClauses.push('messages = ?'); values.push(JSON.stringify(messages)) }
  if (Array.isArray(meeting_ids)) { setClauses.push('meeting_ids = ?'); values.push(JSON.stringify(meeting_ids)) }
  if (typeof title === 'string') { setClauses.push('title = ?'); values.push(title) }
  if (setClauses.length === 0) return res.status(400).json({ error: 'Nothing to update' })
  setClauses.push('updated_at = ?'); values.push(new Date().toISOString(), req.params.id, req.teamId)
  const { changes } = db.prepare(`UPDATE ai_sessions SET ${setClauses.join(', ')} WHERE id = ? AND team_id = ?`).run(...values)
  if (!changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.delete('/ai-sessions/:id', requireAuth, requireTeam, (req, res) => {
  const { changes } = db.prepare('DELETE FROM ai_sessions WHERE id = ? AND team_id = ?').run(req.params.id, req.teamId)
  if (!changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

const PORT = process.env.PORT || 5001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
