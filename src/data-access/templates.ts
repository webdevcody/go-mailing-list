import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { templates, type Template } from '~/db/schema'

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
