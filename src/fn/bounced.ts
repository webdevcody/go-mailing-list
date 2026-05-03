import { createServerFn } from '@tanstack/react-start'

export const fetchBouncedSubscribers = createServerFn({ method: 'GET' }).handler(async () => {
  const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
  const { listBouncedEmails } = await import('~/data-access/emails')
  await assertAuthenticatedFromServerContext()
  return listBouncedEmails()
})

export const removeBouncedSubscribers = createServerFn({ method: 'POST' }).handler(async () => {
  const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
  const { deleteBouncedEmails } = await import('~/data-access/emails')
  await assertAuthenticatedFromServerContext()
  const deleted = await deleteBouncedEmails()
  return { deleted }
})
