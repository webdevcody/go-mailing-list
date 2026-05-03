import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/bounced')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isBounceWebhookAuthorized } = await import('~/lib/auth.server')

        if (!isBounceWebhookAuthorized(request.headers.get('authorization'))) {
          console.warn('bounce webhook: unauthorized request')
          return new Response(null, { status: 401 })
        }

        const form = await request.formData()
        const email = form.get('email')
        const reason = form.get('reason')

        if (typeof email !== 'string' || !email) {
          console.warn('bounce webhook: missing email')
          return new Response(null, { status: 400 })
        }

        try {
          const { markEmailBounced } = await import('~/data-access/emails')
          await markEmailBounced(email, typeof reason === 'string' ? reason : undefined)
          console.info('bounce webhook: marked bounced', { email })
          return new Response(null, { status: 200 })
        } catch (error) {
          console.error('bounce webhook: failed to mark bounced', { email, error })
          return new Response(null, { status: 500 })
        }
      },
    },
  },
})
