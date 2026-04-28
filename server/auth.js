import jwt from 'jsonwebtoken'
import pool from './db.js'

export const JWT_SECRET = process.env.JWT_SECRET || 'meetiq-dev-secret-change-in-production'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Login required.' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}

export async function requireTeam(req, res, next) {
  const teamId = req.headers['x-team-id']
  if (!teamId) return res.status(400).json({ error: 'X-Team-Id header required.' })
  try {
    const { rows } = await pool.query(
      'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
      [req.user.id, teamId]
    )
    if (!rows[0]) return res.status(403).json({ error: 'You are not a member of this team.' })
    req.teamId = teamId
    req.teamRole = rows[0].role
    next()
  } catch (err) {
    console.error('requireTeam error:', err)
    res.status(500).json({ error: 'Database error.' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.teamRole !== 'admin') return res.status(403).json({ error: 'Admin access required.' })
  next()
}
