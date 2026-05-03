import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AlertTriangle, Download, Plus, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
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
import { addSubscribers, removeSubscriber } from '~/fn/subscribers'
import { removeBouncedSubscribers } from '~/fn/bounced'
import { getAuthState } from '~/fn/auth'
import { authQueryOptions, useAuth } from '~/queries/auth'
import { subscribersQueryOptions, useSubscribers } from '~/queries/subscribers'
import { bouncedQueryOptions, useBouncedSubscribers } from '~/queries/bounced'

export const Route = createFileRoute('/dashboard/list')({
  loader: async ({ context }) => {
    const auth = await getAuthState()

    if (!auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }

    await Promise.all([
      context.queryClient.ensureQueryData(authQueryOptions()),
      context.queryClient.ensureQueryData(subscribersQueryOptions()),
      context.queryClient.ensureQueryData(bouncedQueryOptions()),
    ])
  },
  component: SubscriberListPage,
})

function SubscriberListPage() {
  const { data: auth } = useAuth()
  const { data: emails } = useSubscribers()
  const { data: bouncedEmails } = useBouncedSubscribers()
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isDeletingBounced, setIsDeletingBounced] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
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
      await queryClient.invalidateQueries({ queryKey: ['subscribers'] })
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
      await queryClient.invalidateQueries({ queryKey: ['subscribers'] })
      toast.success('Subscriber removed')
    } catch {
      toast.error('Could not remove subscriber')
    } finally {
      setDeletingId(null)
    }
  }

  async function onDeleteBounced() {
    setIsDeletingBounced(true)

    try {
      const result = await removeBouncedSubscribers()
      setIsConfirmOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['bounced-subscribers'] })
      toast.success(`Deleted ${result.deleted} bounced email${result.deleted === 1 ? '' : 's'}`)
    } catch {
      toast.error('Could not delete bounced emails')
    } finally {
      setIsDeletingBounced(false)
    }
  }

  return (
    <AppShell auth={auth} section="subscribers">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Subscribers</h1>
            <p className="text-muted-foreground mt-2">Add addresses, review the current list, and remove stale entries.</p>
          </div>
          <Button asChild variant="outline">
            <a href="/api/export" download>
              <Download />
              Export CSV
            </a>
          </Button>
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
            <CardDescription>These addresses receive bulk sends unless they unsubscribe or are flagged as bounced.</CardDescription>
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

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Bounced emails ({bouncedEmails.length})</CardTitle>
              <CardDescription>These addresses are flagged from SES bounce events and are excluded from bulk sends.</CardDescription>
            </div>
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={bouncedEmails.length === 0}>
                  <Trash2 />
                  Delete all bounced
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete bounced emails?</DialogTitle>
                  <DialogDescription>
                    This will permanently remove {bouncedEmails.length} bounced email
                    {bouncedEmails.length === 1 ? '' : 's'} from the mailing list.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button variant="destructive" isLoading={isDeletingBounced} onClick={onDeleteBounced}>
                    <AlertTriangle />
                    Confirm delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {bouncedEmails.length === 0 ? (
              <EmptyState title="No bounced emails" description="Bounced addresses will appear here after SES reports them." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-48">Bounced at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bouncedEmails.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.email}</TableCell>
                      <TableCell>{item.bounceReason || 'Bounce'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.bouncedAt ? new Date(item.bouncedAt).toLocaleString() : ''}
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
