import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/bounced')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isRequestAuthenticated } = await import('~/lib/auth.server')

        if (!(await isRequestAuthenticated(request))) {
          return new Response(null, { status: 401 })
        }

        const form = await request.formData()
        const email = form.get('email')

        if (typeof email !== 'string' || !email) {
          return new Response(null, { status: 400 })
        }

        const { deleteEmailByEmail } = await import('~/lib/repositories')
        await deleteEmailByEmail(email)
        return new Response(null, { status: 200 })
      },
    },
  },
})
