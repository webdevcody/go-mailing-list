import { createServerFn } from '@tanstack/react-start'

export type AuthState = {
  isAuthenticated: boolean
}

export const getAuthState = createServerFn({ method: 'GET' }).handler(async () => {
  const { getAuthStateFromServerContext } = await import('~/lib/auth.server')
  return getAuthStateFromServerContext()
})

export const login = createServerFn({ method: 'POST' })
  .inputValidator((input: { password: string }) => input)
  .handler(async ({ data }) => {
    const { loginFromServerContext } = await import('~/lib/auth.server')
    return loginFromServerContext(data.password)
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const { logoutFromServerContext } = await import('~/lib/auth.server')
  return logoutFromServerContext()
})
