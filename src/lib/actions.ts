import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const idInput = z.object({ id: z.number().int().positive() })
const saveTemplateInput = z.object({
  id: z.number().int().positive(),
  mjml: z.string(),
  html: z.string(),
  text: z.string(),
  subject: z.string().trim().min(1),
})
const sendInput = z.object({
  subject: z.string().trim().min(1),
  html: z.string(),
  text: z.string(),
})
const sendTestInput = sendInput.extend({
  tester: z.string().trim().email(),
})

export const fetchSubscribers = createServerFn({ method: 'GET' }).handler(async () => {
  const { fetchSubscribersFromServer } = await import('./actions.server')
  return fetchSubscribersFromServer()
})

export const fetchBouncedSubscribers = createServerFn({ method: 'GET' }).handler(async () => {
  const { fetchBouncedSubscribersFromServer } = await import('./actions.server')
  return fetchBouncedSubscribersFromServer()
})

export const addSubscribers = createServerFn({ method: 'POST' })
  .inputValidator((input: { emails: string }) => input)
  .handler(async ({ data }) => {
    const { addSubscribersFromServer } = await import('./actions.server')
    return addSubscribersFromServer(data.emails)
  })

export const removeSubscriber = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof idInput>) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { removeSubscriberFromServer } = await import('./actions.server')
    return removeSubscriberFromServer(data.id)
  })

export const removeBouncedSubscribers = createServerFn({ method: 'POST' }).handler(async () => {
  const { removeBouncedSubscribersFromServer } = await import('./actions.server')
  return removeBouncedSubscribersFromServer()
})

export const fetchTemplates = createServerFn({ method: 'GET' }).handler(async () => {
  const { fetchTemplatesFromServer } = await import('./actions.server')
  return fetchTemplatesFromServer()
})

export const fetchTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof idInput>) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchTemplateFromServer } = await import('./actions.server')
    return fetchTemplateFromServer(data.id)
  })

export const makeTemplate = createServerFn({ method: 'POST' }).handler(async () => {
  const { makeTemplateFromServer } = await import('./actions.server')
  return makeTemplateFromServer()
})

export const saveTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof saveTemplateInput>) => saveTemplateInput.parse(input))
  .handler(async ({ data }) => {
    const { saveTemplateFromServer } = await import('./actions.server')
    return saveTemplateFromServer(data)
  })

export const removeTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof idInput>) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { removeTemplateFromServer } = await import('./actions.server')
    return removeTemplateFromServer(data.id)
  })

export const convertTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: { mjml: string }) => input)
  .handler(async ({ data }) => {
    const { convertTemplateFromServer } = await import('./actions.server')
    return convertTemplateFromServer(data.mjml)
  })

export const sendTemplateToSubscribers = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof sendInput>) => sendInput.parse(input))
  .handler(async ({ data }) => {
    const { sendTemplateToSubscribersFromServer } = await import('./actions.server')
    return sendTemplateToSubscribersFromServer(data)
  })

export const sendTestTemplate = createServerFn({ method: 'POST' })
  .inputValidator((input: z.infer<typeof sendTestInput>) => sendTestInput.parse(input))
  .handler(async ({ data }) => {
    const { sendTestTemplateFromServer } = await import('./actions.server')
    return sendTestTemplateFromServer(data)
  })

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
    const { unsubscribeEmailFromServer } = await import('./actions.server')
    return unsubscribeEmailFromServer(data.unsubscribeId)
  })
