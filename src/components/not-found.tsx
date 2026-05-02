import { Link } from '@tanstack/react-router'
import { Button } from './ui/button'

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you requested does not exist.</p>
      <Button asChild>
        <Link to="/dashboard/list">Go to dashboard</Link>
      </Button>
    </main>
  )
}
