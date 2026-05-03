import {
  getCookie,
  getRequestHeader,
  setCookie,
} from '@tanstack/react-start/server'
import type { AuthState } from './auth'
import { createSession, deleteSession, findSession } from './repositories'
import { constantTimeEqual, randomHex } from './crypto'

const sessionCookieName = 'session'
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30
const maxLoginAttempts = 5
const loginAttemptWindowSeconds = 60 * 15
const loginAttemptBuckets = new Map<string, { count: number; resetAt: number }>()

function expectedPassword() {
  return process.env.PASSWORD ?? ''
}

function expectedBounceWebhookSecret() {
  return process.env.BOUNCE_WEBHOOK_SECRET ?? ''
}

export function isValidPassword(password: string) {
  const expected = expectedPassword()

  if (!expected) {
    return false
  }

  return constantTimeEqual(password, expected)
}

export function isValidBounceWebhookToken(token: string) {
  const expected = expectedBounceWebhookSecret()

  if (!expected) {
    return false
  }

  return constantTimeEqual(token, expected)
}

export function isBounceWebhookAuthorized(header: string | null) {
  if (!header) {
    return false
  }

  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header
  return isValidBounceWebhookToken(token)
}

function assertUnderLoginRateLimit(key: string) {
  const now = Math.floor(Date.now() / 1000)
  const bucket = loginAttemptBuckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    loginAttemptBuckets.set(key, { count: 1, resetAt: now + loginAttemptWindowSeconds })

    if (loginAttemptBuckets.size > 1024) {
      for (const [bucketKey, value] of loginAttemptBuckets) {
        if (now > value.resetAt) {
          loginAttemptBuckets.delete(bucketKey)
        }
      }
    }

    return
  }

  if (bucket.count >= maxLoginAttempts) {
    throw new Error('Too many login attempts')
  }

  bucket.count += 1
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

function rateLimitKeyFromServerContext() {
  const forwarded = getRequestHeader('x-forwarded-for')

  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()

    if (first) {
      return first
    }
  }

  return getRequestHeader('x-real-ip') ?? 'unknown'
}

export async function loginFromServerContext(password: string) {
  assertUnderLoginRateLimit(rateLimitKeyFromServerContext())

  if (!isValidPassword(password)) {
    return {
      ok: false,
      message: 'Invalid password',
    }
  }

  const sessionId = randomHex(32)
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000)
  await createSession(sessionId, expiresAt)
  setCookie(sessionCookieName, sessionId, {
    httpOnly: true,
    secure:
      process.env.SESSION_COOKIE_SECURE === 'false'
        ? false
        : process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: sessionMaxAgeSeconds,
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
