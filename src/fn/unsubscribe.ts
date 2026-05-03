import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const unsubscribeInput = z.object({
  unsubscribeId: z
    .string()
    .min(16)
    .max(128)
    .regex(/^[a-f0-9]+$/i, 'Invalid unsubscribe id'),
})

export const unsubscribeEmail = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof unsubscribeInput>) => unsubscribeInput.parse(input))
  .handler(async ({ data }) => {
    const { deleteEmailByUnsubscribeId } = await import('~/data-access/emails')
    await deleteEmailByUnsubscribeId(data.unsubscribeId)
    return { ok: true }
  })
