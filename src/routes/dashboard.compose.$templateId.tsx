import { createFileRoute, notFound, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { Mail, Save, Send, Trash2, Wand2 } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
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
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import {
  convertTemplate,
  fetchTemplate,
  removeTemplate,
  saveTemplate,
  sendTemplateToSubscribers,
  sendTestTemplate,
} from '~/lib/actions'
import { getAuthState } from '~/lib/auth'

export const Route = createFileRoute('/dashboard/compose/$templateId')({
  loader: async ({ params }) => {
    const auth = await getAuthState()

    if (!auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }

    const id = Number(params.templateId)

    if (!Number.isInteger(id) || id <= 0) {
      throw notFound()
    }

    const template = await fetchTemplate({ data: { id } })

    if (!template) {
      throw notFound()
    }

    return { auth, template }
  },
  component: TemplateEditorPage,
})

function TemplateEditorPage() {
  const { auth, template } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [subject, setSubject] = useState(template.subject ?? '')
  const [mjml, setMjml] = useState(template.mjml ?? '')
  const [html, setHtml] = useState(template.html ?? '')
  const [text, setText] = useState(template.text ?? '')
  const [errors, setErrors] = useState<Array<string>>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testDialogOpen, setTestDialogOpen] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setIsConverting(true)

      try {
        const result = await convertTemplate({ data: { mjml } })
        setHtml(result.html)
        setText(result.text)
        setErrors(result.errors)
      } catch {
        setErrors(['MJML conversion failed.'])
      } finally {
        setIsConverting(false)
      }
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [mjml])

  const hasContent = useMemo(() => subject.trim() && html.trim() && text.trim(), [subject, html, text])

  async function onSave(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setIsSaving(true)

    try {
      await saveTemplate({
        data: {
          id: template.id,
          mjml,
          html,
          text,
          subject,
        },
      })
      await router.invalidate()
      toast.success('Template saved')
    } catch {
      toast.error('Could not save template')
    } finally {
      setIsSaving(false)
    }
  }

  async function onDelete() {
    if (!window.confirm('Delete this template?')) {
      return
    }

    setIsDeleting(true)

    try {
      await removeTemplate({ data: { id: template.id } })
      toast.success('Template deleted')
      await navigate({ to: '/dashboard/compose' })
    } catch {
      toast.error('Could not delete template')
    } finally {
      setIsDeleting(false)
    }
  }

  async function onSendSubscribers() {
    if (!window.confirm('Email everyone on your mailing list?')) {
      return
    }

    setIsSending(true)

    try {
      await sendTemplateToSubscribers({ data: { subject, html, text } })
      toast.success('Bulk send accepted')
      await navigate({ to: '/dashboard/compose' })
    } catch {
      toast.error('Could not start bulk send')
    } finally {
      setIsSending(false)
    }
  }

  async function onSendTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSending(true)

    try {
      await sendTestTemplate({ data: { subject, html, text, tester: testEmail } })
      toast.success('Test send accepted')
      setTestDialogOpen(false)
      setTestEmail('')
    } catch {
      toast.error('Could not send test email')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AppShell auth={auth} section="compose">
      <form className="space-y-8" onSubmit={onSave}>
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Compose email</h1>
            <p className="text-muted-foreground mt-2">Edit MJML, preview the rendered HTML, and save the generated plain text.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="secondary" disabled={!hasContent || isSending}>
                  <Mail />
                  Send test
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={onSendTest} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Send test email</DialogTitle>
                    <DialogDescription>Enter the address that should receive this draft.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="test-email">Email</Label>
                    <Input
                      id="test-email"
                      type="email"
                      required
                      value={testEmail}
                      onChange={(event) => setTestEmail(event.currentTarget.value)}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" isLoading={isSending}>
                      Send
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button type="button" disabled={!hasContent || isSending} onClick={onSendSubscribers}>
              <Send />
              Send to subscribers
            </Button>
            <Button type="button" variant="destructive" isLoading={isDeleting} onClick={onDelete}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campaign details</CardTitle>
            <CardDescription>The subject is sent with the HTML and text generated from the MJML body.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                required
                value={subject}
                onChange={(event) => setSubject(event.currentTarget.value)}
              />
            </div>
            {errors.length > 0 ? (
              <Alert variant="warning">
                <AlertTitle>MJML warnings</AlertTitle>
                <AlertDescription>{errors.join(' ')}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="min-h-[640px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="size-5" />
                MJML
              </CardTitle>
              <CardDescription>Changes render into the preview after a short pause.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={mjml}
                onChange={(event) => setMjml(event.currentTarget.value)}
                required
                spellCheck={false}
                className="min-h-[500px] resize-y font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card className="min-h-[640px]">
            <CardHeader>
              <CardTitle>HTML preview</CardTitle>
              <CardDescription>{isConverting ? 'Rendering preview...' : 'Rendered output for the email body.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="email-preview h-[500px] overflow-hidden rounded-md border bg-white">
                <iframe title="Email preview" className="h-full w-full bg-white" srcDoc={html} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Button type="submit" isLoading={isSaving} className="w-full">
          <Save />
          Save template
        </Button>
      </form>
    </AppShell>
  )
}
