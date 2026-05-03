import { createFileRoute } from '@tanstack/react-router'

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const Route = createFileRoute('/api/export')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isRequestAuthenticated } = await import('~/lib/auth.server')

        if (!(await isRequestAuthenticated(request))) {
          return new Response(null, { status: 401 })
        }

        const { listAllEmails } = await import('~/data-access/emails')
        const rows = await listAllEmails()

        const header = ['id', 'email', 'unsubscribeId', 'bouncedAt', 'bounceReason']
        const lines = [header.join(',')]
        for (const row of rows) {
          lines.push(
            [
              String(row.id),
              escapeCsv(row.email ?? ''),
              escapeCsv(row.unsubscribeId ?? ''),
              escapeCsv(row.bouncedAt ?? ''),
              escapeCsv(row.bounceReason ?? ''),
            ].join(','),
          )
        }

        const csv = `${lines.join('\n')}\n`
        const date = new Date().toISOString().slice(0, 10)

        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="subscribers-${date}.csv"`,
          },
        })
      },
    },
  },
})
