import { Link } from '@tanstack/react-router'
import { Inbox, LogOut, PenLine, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthState } from '~/fn/auth'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

type AppShellProps = {
  auth: AuthState
  section?: 'subscribers' | 'compose'
  children: React.ReactNode
}

export function AppShell({ auth, section, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <img src="/logo.png" alt="" className="size-8" />
            Mailing List
          </Link>
          {auth.isAuthenticated ? (
            <Button variant="ghost" asChild>
              <Link to="/logout">
                <LogOut />
                Logout
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <Link to="/login">Login</Link>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        {auth.isAuthenticated ? (
          <aside className="lg:sticky lg:top-8 lg:h-fit">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col">
              <NavLink
                to="/dashboard/list"
                active={section === 'subscribers'}
                icon={<Users />}
              >
                Subscribers
              </NavLink>
              <NavLink to="/dashboard/compose" active={section === 'compose'} icon={<PenLine />}>
                Compose
              </NavLink>
            </nav>
            <Separator className="mt-6 hidden lg:block" />
          </aside>
        ) : null}
        <section className={cn(!auth.isAuthenticated && 'lg:col-span-2')}>{children}</section>
      </main>
    </div>
  )
}

function NavLink({
  to,
  active,
  icon,
  children,
}: {
  to: '/dashboard/list' | '/dashboard/compose'
  active: boolean
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      className={cn('justify-start', active && 'border border-border')}
      asChild
    >
      <Link to={to}>
        <span className="[&_svg]:size-4">{icon}</span>
        {children}
      </Link>
    </Button>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <Inbox className="text-muted-foreground mb-3 size-8" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
    </div>
  )
}
