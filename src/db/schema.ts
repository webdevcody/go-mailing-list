import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const emails = sqliteTable(
  'emails',
  {
    id: integer('id').primaryKey(),
    email: text('email'),
    unsubscribeId: text('unsubscribeId'),
  },
  (table) => [uniqueIndex('email_unique').on(table.email)],
)

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey(),
  sessionId: text('sessionId'),
})

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey(),
  mjml: text('mjml'),
  html: text('html'),
  text: text('text'),
  subject: text('subject'),
})

export const legacyMigrations = sqliteTable('migrations', {
  key: text('key').primaryKey(),
  createdAt: text('createdAt'),
})

export type Email = typeof emails.$inferSelect
export type NewEmail = typeof emails.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
