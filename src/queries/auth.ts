import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { getAuthState } from '~/fn/auth'

export const authQueryOptions = () =>
  queryOptions({
    queryKey: ['auth'],
    queryFn: () => getAuthState(),
  })

export const useAuth = () => useSuspenseQuery(authQueryOptions())
