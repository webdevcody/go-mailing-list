import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { fetchTemplate, fetchTemplates } from '~/fn/templates'

export const templatesQueryOptions = () =>
  queryOptions({
    queryKey: ['templates'],
    queryFn: () => fetchTemplates(),
  })

export const templateQueryOptions = (id: number) =>
  queryOptions({
    queryKey: ['templates', id],
    queryFn: () => fetchTemplate({ data: { id } }),
  })

export const useTemplates = () => useSuspenseQuery(templatesQueryOptions())
export const useTemplate = (id: number) => useSuspenseQuery(templateQueryOptions(id))
