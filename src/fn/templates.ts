import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const idInput = z.object({ id: z.number().int().positive() })
const saveInput = z.object({
  id: z.number().int().positive(),
  mjml: z.string(),
  html: z.string(),
  text: z.string(),
  subject: z.string().trim().min(1),
})
const convertInput = z.object({ mjml: z.string() })

export const fetchTemplates = createServerFn({ method: 'GET' }).handler(async () => {
  const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
  const { listTemplates } = await import('~/data-access/templates')
  await assertAuthenticatedFromServerContext()
  return listTemplates()
})

export const fetchTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof idInput>) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { getTemplate } = await import('~/data-access/templates')
    await assertAuthenticatedFromServerContext()
    return getTemplate(data.id)
  })

export const makeTemplate = createServerFn({ method: 'POST' }).handler(async () => {
  const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
  const { createTemplate } = await import('~/data-access/templates')
  await assertAuthenticatedFromServerContext()
  return createTemplate()
})

export const saveTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof saveInput>) => saveInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { updateTemplate } = await import('~/data-access/templates')
    await assertAuthenticatedFromServerContext()
    const template = await updateTemplate(data)
    return { template }
  })

export const removeTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof idInput>) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { deleteTemplate } = await import('~/data-access/templates')
    await assertAuthenticatedFromServerContext()
    await deleteTemplate(data.id)
    return { ok: true }
  })

export const convertTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof convertInput>) => convertInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAuthenticatedFromServerContext } = await import('~/lib/auth.server')
    const { convertMjml } = await import('~/lib/mjml')
    await assertAuthenticatedFromServerContext()
    return convertMjml(data.mjml)
  })
