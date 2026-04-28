import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dir, 'meetings.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    invite_token TEXT UNIQUE NOT NULL,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'member',
    joined_at  TEXT NOT NULL,
    UNIQUE(user_id, team_id)
  );
  CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

  CREATE TABLE IF NOT EXISTS meetings (
    id           TEXT PRIMARY KEY,
    team_id      TEXT NOT NULL DEFAULT 'legacy',
    title        TEXT NOT NULL,
    date         TEXT NOT NULL,
    transcript   TEXT NOT NULL,
    summary      TEXT NOT NULL,
    decisions    TEXT NOT NULL,
    action_items TEXT NOT NULL,
    pain_points  TEXT NOT NULL DEFAULT '[]',
    person_wise  TEXT NOT NULL,
    speakers     TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);

  CREATE TABLE IF NOT EXISTS participants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    name       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_participants_name    ON participants(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_participants_meeting ON participants(meeting_id);

  CREATE TABLE IF NOT EXISTS ai_sessions (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL DEFAULT 'legacy',
    title       TEXT NOT NULL,
    messages    TEXT NOT NULL DEFAULT '[]',
    meeting_ids TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated ON ai_sessions(updated_at DESC);
`)

// Safe column migrations for existing DBs
const meetingCols = db.pragma('table_info(meetings)').map(c => c.name)
if (!meetingCols.includes('pain_points')) {
  db.exec("ALTER TABLE meetings ADD COLUMN pain_points TEXT NOT NULL DEFAULT '[]'")
}
if (!meetingCols.includes('team_id')) {
  db.exec("ALTER TABLE meetings ADD COLUMN team_id TEXT NOT NULL DEFAULT 'legacy'")
}
db.exec("CREATE INDEX IF NOT EXISTS idx_meetings_team ON meetings(team_id)")

const sessionCols = db.pragma('table_info(ai_sessions)').map(c => c.name)
if (!sessionCols.includes('team_id')) {
  db.exec("ALTER TABLE ai_sessions ADD COLUMN team_id TEXT NOT NULL DEFAULT 'legacy'")
}
db.exec("CREATE INDEX IF NOT EXISTS idx_ai_sessions_team ON ai_sessions(team_id)")

export default db
