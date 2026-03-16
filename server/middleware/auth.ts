import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { readConfig } from '../lib/config.js'

const COOKIE_NAME = 'oc_auth'

let cachedToken = ''
let cachedAt = 0
const CACHE_TTL = 30_000 // 30s

async function getToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now - cachedAt < CACHE_TTL) return cachedToken
  try {
    const config = await readConfig()
    cachedToken = config?.gateway?.auth?.token || ''
    cachedAt = now
  } catch {
    // keep cached value on read failure
  }
  return cachedToken
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const cookie = getCookie(c, COOKIE_NAME)
  const expected = await getToken()

  if (!expected || !cookie || cookie !== expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}
