import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { FileText, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AppShell, EmptyState } from '~/components/app-shell'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { getAuthState } from '~/fn/auth'
import { makeTemplate } from '~/fn/templates'
import { authQueryOptions, useAuth } from '~/queries/auth'
import { templatesQueryOptions, useTemplates } from '~/queries/templates'

export const Route = createFileRoute('/dashboard/compose')({
  loader: async ({ context }) => {
    const auth = await getAuthState()

    if (!auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }

    await Promise.all([
      context.queryClient.ensureQueryData(authQueryOptions()),
      context.queryClient.ensureQueryData(templatesQueryOptions()),
    ])
  },
  component: TemplateListPage,
})

function TemplateListPage() {
  const { data: auth } = useAuth()
  const { data: templates } = useTemplates()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)

  async function onCreate() {
    setIsCreating(true)

    try {
      const template = await makeTemplate()
      await queryClient.invalidateQueries({ queryKey: ['templates'] })
      await navigate({
        to: '/dashboard/compose/$templateId',
        params: { templateId: String(template.id) },
      })
    } catch {
      toast.error('Could not create template')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AppShell auth={auth} section="compose">
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Templates</h1>
            <p className="text-muted-foreground mt-2">Create MJML campaigns, preview output, and send to the list.</p>
          </div>
          <Button onClick={onCreate} isLoading={isCreating}>
            <Plus />
            Create template
          </Button>
        </div>

        {templates.length === 0 ? (
          <EmptyState title="No templates" description="Create a template to draft your first campaign." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="min-h-56">
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <FileText className="size-4" />
                  </div>
                  <CardTitle className="line-clamp-2">{template.subject || 'Untitled template'}</CardTitle>
                  <CardDescription className="line-clamp-4">
                    {(template.text || 'No plain-text preview yet.').slice(0, 220)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1" />
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link
                      to="/dashboard/compose/$templateId"
                      params={{ templateId: String(template.id) }}
                    >
                      Edit
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
