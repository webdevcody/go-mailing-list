import { createFileRoute } from '@tanstack/react-router'
import { isEmail } from '~/lib/email-validation'

export const Route = createFileRoute('/api/subscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isRequestAuthenticated } = await import('~/lib/auth.server')

        if (!(await isRequestAuthenticated(request))) {
          return new Response(null, { status: 401 })
        }

        const email = await readEmail(request)

        if (!email || !isEmail(email)) {
          return new Response(null, { status: 400 })
        }

        try {
          const { createEmail } = await import('~/lib/repositories')
          await createEmail(email.trim().toLowerCase())
          return new Response(null, { status: 200 })
        } catch {
          return new Response(null, { status: 400 })
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
