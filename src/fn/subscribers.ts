import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const idInput = z.object({ id: z.number().int().positive() })
const addInput = z.object({ emails: z.string() })

export const fetchSubscribers = createServerFn({ method: 'GET' }).handler(async () => {
  const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
  const { listEmails } = await import('~/data-access/emails')
  await assertAuthenticatedFromServerContext()
  return listEmails()
})

export const addSubscribers = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof addInput>) => addInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { parseEmailLines } = await import('~/lib/email-validation')
    const { createEmails } = await import('~/data-access/emails')
    await assertAuthenticatedFromServerContext()
    const parsed = parseEmailLines(data.emails)
    const result = await createEmails(parsed.valid)
    return {
      created: result.created,
      duplicates: result.duplicates,
      invalid: parsed.invalid,
    }
  })

export const removeSubscriber = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof idInput>) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { deleteEmailById } = await import('~/data-access/emails')
    await assertAuthenticatedFromServerContext()
    await deleteEmailById(data.id)
    return { ok: true }
  })
