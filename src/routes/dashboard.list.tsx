import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AppShell, EmptyState } from '~/components/app-shell'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { addSubscribers, fetchSubscribers, removeSubscriber } from '~/lib/actions'
import { getAuthState } from '~/lib/auth'

export const Route = createFileRoute('/dashboard/list')({
  loader: async () => {
    const auth = await getAuthState()

    if (!auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }

    return {
      auth,
      emails: await fetchSubscribers(),
    }
  },
  component: SubscriberListPage,
})

function SubscriberListPage() {
  const { auth, emails } = Route.useLoaderData()
  const router = useRouter()
  const [value, setValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [summary, setSummary] = useState<{
    created: number
    duplicates: number
    invalid: Array<string>
  } | null>(null)

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsAdding(true)
    setSummary(null)

    try {
      const result = await addSubscribers({ data: { emails: value } })
      setSummary({
        created: result.created.length,
        duplicates: result.duplicates.length,
        invalid: result.invalid,
      })
      setValue('')
      await router.invalidate()
      toast.success(`Added ${result.created.length} subscriber${result.created.length === 1 ? '' : 's'}`)
    } catch {
      toast.error('Could not add subscribers')
    } finally {
      setIsAdding(false)
    }
  }

  async function onDelete(id: number) {
    setDeletingId(id)

    try {
      await removeSubscriber({ data: { id } })
      await router.invalidate()
      toast.success('Subscriber removed')
    } catch {
      toast.error('Could not remove subscriber')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppShell auth={auth} section="subscribers">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Subscribers</h1>
          <p className="text-muted-foreground mt-2">Add addresses, review the current list, and remove stale entries.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add subscribers</CardTitle>
            <CardDescription>Paste one email per line. Valid addresses are added and invalid rows are reported.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onAdd}>
              <div className="space-y-2">
                <Label htmlFor="emails">Emails</Label>
                <Textarea
                  id="emails"
                  value={value}
                  onChange={(event) => setValue(event.currentTarget.value)}
                  required
                  autoFocus
                  placeholder="test@example.com"
                  className="min-h-32"
                />
              </div>
              {summary ? <ImportSummary summary={summary} /> : null}
              <Button type="submit" isLoading={isAdding}>
                <Plus />
                Add email(s)
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current list ({emails.length})</CardTitle>
            <CardDescription>These addresses receive bulk sends unless they unsubscribe or bounce.</CardDescription>
          </CardHeader>
          <CardContent>
            {emails.length === 0 ? (
              <EmptyState title="No subscribers" description="Add one or more email addresses to start building the list." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.email}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${item.email}`}
                          isLoading={deletingId === item.id}
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

function ImportSummary({
  summary,
}: {
  summary: { created: number; duplicates: number; invalid: Array<string> }
}) {
  if (summary.created === 0 && summary.duplicates === 0 && summary.invalid.length === 0) {
    return null
  }

  return (
    <Alert variant={summary.invalid.length > 0 ? 'warning' : 'default'}>
      <AlertTitle>Import complete</AlertTitle>
      <AlertDescription>
        Added {summary.created}. Skipped {summary.duplicates} duplicate{summary.duplicates === 1 ? '' : 's'}.
        {summary.invalid.length > 0 ? ` Invalid: ${summary.invalid.join(', ')}` : ''}
      </AlertDescription>
    </Alert>
  )
}
