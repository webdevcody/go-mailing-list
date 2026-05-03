import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { fetchBouncedSubscribers } from '~/fn/bounced'

export const bouncedQueryOptions = () =>
  queryOptions({
    queryKey: ['bounced-subscribers'],
    queryFn: () => fetchBouncedSubscribers(),
  })

export const useBouncedSubscribers = () => useSuspenseQuery(bouncedQueryOptions())
