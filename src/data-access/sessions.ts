import { eq, lte } from 'drizzle-orm'
import { db } from '~/db'
import { sessions } from '~/db/schema'

export async function findSession(sessionId: string) {
  const session = db.select().from(sessions).where(eq(sessions.sessionId, sessionId)).get()

  if (!session) {
    return undefined
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    db.delete(sessions).where(eq(sessions.sessionId, sessionId)).run()
    return undefined
  }

  return session
}

export async function createSession(sessionId: string, expiresAt: Date) {
  return db.insert(sessions).values({ sessionId, expiresAt: expiresAt.toISOString() }).returning().get()
}

export async function deleteSession(sessionId: string) {
  db.delete(sessions).where(eq(sessions.sessionId, sessionId)).run()
}

export async function deleteExpiredSessions() {
  const now = new Date().toISOString()
  db.delete(sessions).where(lte(sessions.expiresAt, now)).run()
}
