import { eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '~/db'
import { emails } from '~/db/schema'
import { randomHex } from '~/lib/crypto'

export async function listEmails() {
  return db.select().from(emails).where(isNull(emails.bouncedAt)).orderBy(emails.email)
}

export async function listAllEmails() {
  return db.select().from(emails).orderBy(emails.email)
}

export async function listBouncedEmails() {
  return db.select().from(emails).where(isNotNull(emails.bouncedAt)).orderBy(emails.bouncedAt)
}

export async function createEmail(email: string) {
  return db
    .insert(emails)
    .values({
      email,
      unsubscribeId: randomHex(32),
    })
    .returning()
    .get()
}

export async function createEmails(emailList: Array<string>) {
  const created = []
  const duplicates: Array<string> = []

  for (const email of emailList) {
    try {
      const row = await createEmail(email)
      created.push(row)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (message.includes('UNIQUE') || message.includes('unique')) {
        duplicates.push(email)
        continue
      }

      throw error
    }
  }

  return { created, duplicates }
}

export async function deleteEmailById(id: number) {
  db.delete(emails).where(eq(emails.id, id)).run()
}

export async function deleteEmailByEmail(email: string) {
  db.delete(emails).where(eq(emails.email, email)).run()
}

export async function deleteEmailByUnsubscribeId(unsubscribeId: string) {
  db.delete(emails).where(eq(emails.unsubscribeId, unsubscribeId)).run()
}

export async function markEmailBounced(email: string, reason?: string) {
  db
    .update(emails)
    .set({
      bouncedAt: new Date().toISOString(),
      bounceReason: reason || null,
    })
    .where(eq(emails.email, email))
    .run()
}

export async function deleteBouncedEmails() {
  const result = db.delete(emails).where(isNotNull(emails.bouncedAt)).run()
  return result.changes
}
