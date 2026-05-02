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

export const db = drizzle({ client: sqlite, schema })
export { sqlite }
