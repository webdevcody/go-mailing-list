import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { fetchSubscribers } from '~/fn/subscribers'

export const subscribersQueryOptions = () =>
  queryOptions({
    queryKey: ['subscribers'],
    queryFn: () => fetchSubscribers(),
  })

export const useSubscribers = () => useSuspenseQuery(subscribersQueryOptions())
