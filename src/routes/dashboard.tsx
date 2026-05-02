import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ location }) => {
    if (location.pathname === '/dashboard') {
      throw redirect({ to: '/dashboard/list' })
    }
  },
  component: Outlet,
})
