import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const sendInput = z.object({
  subject: z.string().trim().min(1),
  html: z.string(),
  text: z.string(),
})
const sendTestInput = sendInput.extend({
  tester: z.string().trim().email(),
})

export const sendTemplateToSubscribers = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof sendInput>) => sendInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { sendEmails } = await import('~/lib/mailer')
    await assertAuthenticatedFromServerContext()
    void sendEmails(data).catch((error) => console.error('Failed to send bulk email', error))
    return { accepted: true }
  })

export const sendTestTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof sendTestInput>) => sendTestInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { sendEmails } = await import('~/lib/mailer')
    await assertAuthenticatedFromServerContext()
    void sendEmails(data).catch((error) => console.error('Failed to send test email', error))
    return { accepted: true }
  })
