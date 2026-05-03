import { createFileRoute } from '@tanstack/react-router'
import { isEmail } from '~/lib/email-validation'

export const Route = createFileRoute('/api/subscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const email = await readEmail(request)

        if (!email || !isEmail(email)) {
          return new Response(null, { status: 400 })
        }

        const normalized = email.trim().toLowerCase()

        try {
          const { createEmail } = await import('~/data-access/emails')
          await createEmail(normalized)
          return new Response(null, { status: 200 })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)

          if (message.includes('UNIQUE') || message.includes('unique')) {
            return new Response(null, { status: 200 })
          }

          console.error('subscribe: failed to create email', { error })
          return new Response(null, { status: 500 })
        }
      },
    },
  },
})

async function readEmail(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const json = (await request.json()) as { email?: unknown }
    return typeof json.email === 'string' ? json.email : ''
  }

  const form = await request.formData()
  const email = form.get('email')
  return typeof email === 'string' ? email : ''
}
