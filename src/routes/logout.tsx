import { createFileRoute, redirect } from '@tanstack/react-router'
import { logout } from '~/lib/auth'

export const Route = createFileRoute('/logout')({
  loader: async () => {
    await logout()
    throw redirect({ to: '/login' })
  },
})
