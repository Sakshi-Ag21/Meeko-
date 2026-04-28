import jwt from 'jsonwebtoken'
import db from './db.js'

export const JWT_SECRET = process.env.JWT_SECRET || 'meetiq-dev-secret-change-in-production'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

// Verifies JWT — attaches req.user
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

// Verifies team membership — attaches req.teamId + req.teamRole
// Must run after requireAuth
export function requireTeam(req, res, next) {
  const teamId = req.headers['x-team-id']
  if (!teamId) return res.status(400).json({ error: 'X-Team-Id header required.' })

  const member = db.prepare(
    'SELECT role FROM team_members WHERE user_id = ? AND team_id = ?'
  ).get(req.user.id, teamId)

  if (!member) return res.status(403).json({ error: 'You are not a member of this team.' })

  req.teamId = teamId
  req.teamRole = member.role
  next()
}

// Requires admin role within team — must run after requireTeam
export function requireAdmin(req, res, next) {
  if (req.teamRole !== 'admin') return res.status(403).json({ error: 'Admin access required.' })
  next()
}
