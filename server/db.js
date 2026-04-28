import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
})

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      invite_token TEXT UNIQUE NOT NULL,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id        SERIAL PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      role      TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      UNIQUE(user_id, team_id)
    );

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

    CREATE TABLE IF NOT EXISTS participants (
      id         SERIAL PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      name       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_sessions (
      id          TEXT PRIMARY KEY,
      team_id     TEXT NOT NULL DEFAULT 'legacy',
      title       TEXT NOT NULL,
      messages    TEXT NOT NULL DEFAULT '[]',
      meeting_ids TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_team_members_user    ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_team    ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_date        ON meetings(date);
    CREATE INDEX IF NOT EXISTS idx_meetings_team        ON meetings(team_id);
    CREATE INDEX IF NOT EXISTS idx_participants_meeting ON participants(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_ai_sessions_team     ON ai_sessions(team_id);
    CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated  ON ai_sessions(updated_at DESC);
  `)
}

export default pool
