import { ErrorComponent, type ErrorComponentProps, Link } from '@tanstack/react-router'
import { Button } from './ui/button'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium text-destructive">Something failed</p>
        <h1 className="mt-2 text-3xl font-semibold">The app could not finish that request.</h1>
      </div>
      <ErrorComponent error={error} />
      <Button asChild className="w-fit">
        <Link to="/dashboard/list">Back to dashboard</Link>
      </Button>
    </main>
  )
}
