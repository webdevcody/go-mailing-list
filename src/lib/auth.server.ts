import {
  getCookie,
  getRequestHeader,
  setCookie,
} from '@tanstack/react-start/server'
import type { AuthState } from './auth'
import { createSession, deleteSession, findSession } from './repositories'
import { constantTimeEqual, randomHex } from './crypto'

const sessionCookieName = 'session'
const maxLoginAttempts = 5
let attempts = 0
let resetAt = 0

function expectedPassword() {
  return process.env.PASSWORD ?? ''
}

export function isValidPassword(password: string) {
  const expected = expectedPassword()

  if (!expected) {
    return false
  }

  return constantTimeEqual(password, expected)
}

function assertUnderLoginRateLimit() {
  const now = Math.floor(Date.now() / 1000)

  if (now > resetAt) {
    resetAt = now + 1
    attempts = 0
  }

  if (attempts >= maxLoginAttempts) {
    throw new Error('Too many login attempts')
  }

  attempts += 1
}

export function isBearerAuthorized(header: string | null) {
  if (!header) {
    return false
  }

  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header
  return isValidPassword(token)
}

async function isSessionAuthenticated(sessionId: string | undefined) {
  if (!sessionId) {
    return false
  }

  const session = await findSession(sessionId)
  return Boolean(session)
}

function readCookieFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return undefined
  }

  for (const cookie of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = cookie.trim().split('=')

    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='))
    }
  }

  return undefined
}

export async function isRequestAuthenticated(request: Request) {
  const authHeader = request.headers.get('authorization')

  if (isBearerAuthorized(authHeader)) {
    return true
  }

  const sessionId = readCookieFromHeader(request.headers.get('cookie'), sessionCookieName)
  return isSessionAuthenticated(sessionId)
}

export async function getAuthStateFromServerContext() {
  const authHeader = getRequestHeader('authorization')

  if (isBearerAuthorized(authHeader ?? null)) {
    return { isAuthenticated: true } satisfies AuthState
  }

  const sessionId = getCookie(sessionCookieName)
  const isAuthenticated = await isSessionAuthenticated(sessionId)

  return { isAuthenticated } satisfies AuthState
}

export async function assertAuthenticatedFromServerContext() {
  const auth = await getAuthStateFromServerContext()

  if (!auth.isAuthenticated) {
    throw new Error('Unauthorized')
  }
}

export async function loginFromServerContext(password: string) {
  assertUnderLoginRateLimit()

  if (!isValidPassword(password)) {
    return {
      ok: false,
      message: 'Invalid password',
    }
  }

  const sessionId = randomHex(32)
  await createSession(sessionId)
  setCookie(sessionCookieName, sessionId, {
    httpOnly: true,
    secure:
      process.env.SESSION_COOKIE_SECURE === 'false'
        ? false
        : process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })

  return {
    ok: true,
  }
}

export async function logoutFromServerContext() {
  const sessionId = getCookie(sessionCookieName)

  if (sessionId) {
    await deleteSession(sessionId)
  }

  setCookie(sessionCookieName, '', {
    httpOnly: true,
    secure:
      process.env.SESSION_COOKIE_SECURE === 'false'
        ? false
        : process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })

  return {
    ok: true,
  }
}
