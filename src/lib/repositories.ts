import { eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '~/db'
import { emails, sessions, templates, type Template } from '~/db/schema'
import { randomHex } from './crypto'

export async function listEmails() {
  return db.select().from(emails).where(isNull(emails.bouncedAt)).orderBy(emails.email)
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

export async function deleteEmailByUnsubscribeId(unsubscribeId: string) {
  db.delete(emails).where(eq(emails.unsubscribeId, unsubscribeId)).run()
}

export async function findSession(sessionId: string) {
  return db.select().from(sessions).where(eq(sessions.sessionId, sessionId)).get()
}

export async function createSession(sessionId: string) {
  return db.insert(sessions).values({ sessionId }).returning().get()
}

export async function deleteSession(sessionId: string) {
  db.delete(sessions).where(eq(sessions.sessionId, sessionId)).run()
}

export async function listTemplates() {
  return db.select().from(templates).orderBy(templates.id)
}

export async function getTemplate(id: number) {
  return db.select().from(templates).where(eq(templates.id, id)).get()
}

export async function createTemplate() {
  return db
    .insert(templates)
    .values({
      mjml: defaultMjml,
      html: 'HTML',
      text: 'TEXT',
      subject: 'This is your email subject',
    })
    .returning()
    .get()
}

export async function updateTemplate(input: Required<Pick<Template, 'id' | 'mjml' | 'html' | 'text' | 'subject'>>) {
  return db
    .update(templates)
    .set({
      mjml: input.mjml,
      html: input.html,
      text: input.text,
      subject: input.subject,
    })
    .where(eq(templates.id, input.id))
    .returning()
    .get()
}

export async function deleteTemplate(id: number) {
  db.delete(templates).where(eq(templates.id, id)).run()
}

export const defaultMjml = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>

        <mj-image width="100px" src="/assets/img/logo-small.png"></mj-image>

        <mj-divider border-color="#F45E43"></mj-divider>

        <mj-text font-size="20px" color="#F45E43" font-family="helvetica">Hello World</mj-text>

      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`
