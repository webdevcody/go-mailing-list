import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

function normalizeDatabaseUrl(url: string) {
  if (url.startsWith('file:')) {
    return url.slice('file:'.length)
  }

  return url
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL ?? './local.db')
const sqlite = new Database(databaseUrl)

sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const emailColumns = sqlite.prepare('PRAGMA table_info(emails)').all() as Array<{ name: string }>
const emailColumnNames = new Set(emailColumns.map((column) => column.name))

if (emailColumns.length > 0 && !emailColumnNames.has('bouncedAt')) {
  sqlite.exec('ALTER TABLE emails ADD COLUMN bouncedAt TEXT')
}

if (emailColumns.length > 0 && !emailColumnNames.has('bounceReason')) {
  sqlite.exec('ALTER TABLE emails ADD COLUMN bounceReason TEXT')
}

const sessionColumns = sqlite.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>
const sessionColumnNames = new Set(sessionColumns.map((column) => column.name))

if (sessionColumns.length > 0 && !sessionColumnNames.has('expiresAt')) {
  sqlite.exec('ALTER TABLE sessions ADD COLUMN expiresAt TEXT')
}

sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_session_id_unique ON sessions (sessionId)')

export const db = drizzle({ client: sqlite, schema })
export { sqlite }
