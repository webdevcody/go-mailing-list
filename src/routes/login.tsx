import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '~/components/app-shell'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { getAuthState, login } from '~/fn/auth'

export const Route = createFileRoute('/login')({
  loader: () => getAuthState(),
  component: LoginPage,
})

function LoginPage() {
  const auth = Route.useLoaderData()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await login({ data: { password } })

      if (!result.ok) {
        setError(result.message ?? 'Invalid password')
        return
      }

      toast.success('Logged in')
      await navigate({ to: '/dashboard/list' })
    } catch (submitError) {
      const message =
        submitError instanceof Error && submitError.message.includes('Too many')
          ? 'Too many login attempts. Try again in a moment.'
          : 'Login failed'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell auth={auth}>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <CardTitle className="text-2xl">Mailing List Login</CardTitle>
            <CardDescription>Enter the admin password to manage subscribers and campaigns.</CardDescription>
          </CardHeader>
          <CardContent>
            {auth.isAuthenticated ? (
              <div className="space-y-4">
                <Alert>
                  <AlertTitle>Already logged in</AlertTitle>
                  <AlertDescription>You can go straight to the dashboard.</AlertDescription>
                </Alert>
                <Button asChild className="w-full">
                  <Link to="/dashboard/list">View dashboard</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoFocus
                    required
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                  />
                </div>
                {error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Could not log in</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" isLoading={isSubmitting} className="w-full">
                  Login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
