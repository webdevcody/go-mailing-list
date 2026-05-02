import { createFileRoute, redirect } from '@tanstack/react-router'
import { unsubscribeEmail } from '~/lib/actions'

export const Route = createFileRoute('/unsubscribe/$unsubscribeId')({
  loader: async ({ params }) => {
    await unsubscribeEmail({ data: { unsubscribeId: params.unsubscribeId } })
    throw redirect({ to: '/unsubscribe-success' })
  },
})
