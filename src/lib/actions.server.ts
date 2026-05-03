import { assertAuthenticatedFromServerContext } from './auth.server'
import { parseEmailLines } from './email-validation'
import type { SendEmailInput } from './mailer'
import {
  createEmails,
  createTemplate,
  deleteEmailById,
  deleteTemplate,
  getTemplate,
  listEmails,
  listTemplates,
  updateTemplate,
  deleteEmailByUnsubscribeId,
} from './repositories'

type SaveTemplateInput = {
  id: number
  mjml: string
  html: string
  text: string
  subject: string
}

export async function fetchSubscribersFromServer() {
  await assertAuthenticatedFromServerContext()
  return listEmails()
}

export async function addSubscribersFromServer(input: string) {
  await assertAuthenticatedFromServerContext()
  const parsed = parseEmailLines(input)
  const result = await createEmails(parsed.valid)

  return {
    created: result.created,
    duplicates: result.duplicates,
    invalid: parsed.invalid,
  }
}

export async function removeSubscriberFromServer(id: number) {
  await assertAuthenticatedFromServerContext()
  await deleteEmailById(id)
  return { ok: true }
}

export async function fetchTemplatesFromServer() {
  await assertAuthenticatedFromServerContext()
  return listTemplates()
}

export async function fetchTemplateFromServer(id: number) {
  await assertAuthenticatedFromServerContext()
  return getTemplate(id)
}

export async function makeTemplateFromServer() {
  await assertAuthenticatedFromServerContext()
  return createTemplate()
}

export async function saveTemplateFromServer(input: SaveTemplateInput) {
  await assertAuthenticatedFromServerContext()
  const template = await updateTemplate(input)
  return { template }
}

export async function removeTemplateFromServer(id: number) {
  await assertAuthenticatedFromServerContext()
  await deleteTemplate(id)
  return { ok: true }
}

export async function convertTemplateFromServer(mjml: string) {
  await assertAuthenticatedFromServerContext()
  const { convertMjml } = await import('./mjml')
  return await convertMjml(mjml)
}

export async function sendTemplateToSubscribersFromServer(input: SendEmailInput) {
  await assertAuthenticatedFromServerContext()
  const { sendEmails } = await import('./mailer')
  void sendEmails(input).catch((error) => console.error('Failed to send bulk email', error))
  return { accepted: true }
}

export async function sendTestTemplateFromServer(input: SendEmailInput & { tester: string }) {
  await assertAuthenticatedFromServerContext()
  const { sendEmails } = await import('./mailer')
  void sendEmails(input).catch((error) => console.error('Failed to send test email', error))
  return { accepted: true }
}

export async function unsubscribeEmailFromServer(unsubscribeId: string) {
  await deleteEmailByUnsubscribeId(unsubscribeId)
  return { ok: true }
}
