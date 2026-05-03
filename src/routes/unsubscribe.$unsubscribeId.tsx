import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { unsubscribeEmail } from '~/fn/unsubscribe'
import { AppShell } from '~/components/app-shell'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export const Route = createFileRoute('/unsubscribe/$unsubscribeId')({
  component: UnsubscribeConfirmPage,
})

function UnsubscribeConfirmPage() {
  const { unsubscribeId } = Route.useParams()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await unsubscribeEmail({ data: { unsubscribeId } })
      router.navigate({ to: '/unsubscribe-success' })
      throw redirect({ to: '/unsubscribe-success' })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <AppShell auth={{ isAuthenticated: false }}>
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Confirm unsubscribe</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-muted-foreground">
              Click the button below to confirm you want to be removed from the mailing list.
            </p>
            <form onSubmit={handleSubmit}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Unsubscribing…' : 'Unsubscribe me'}
              </Button>
            </form>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
