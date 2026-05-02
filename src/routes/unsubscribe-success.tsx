import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { AppShell } from '~/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export const Route = createFileRoute('/unsubscribe-success')({
  component: UnsubscribeSuccessPage,
})

function UnsubscribeSuccessPage() {
  return (
    <AppShell auth={{ isAuthenticated: false }}>
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <CheckCircle2 className="size-5" />
            </div>
            <CardTitle className="text-2xl">Unsubscribed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You have been successfully unsubscribed from the mailing list.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
