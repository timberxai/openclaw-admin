import { Hono } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { readConfig } from '../lib/config.js'

const COOKIE_NAME = 'oc_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function getGatewayToken(): Promise<string> {
  try {
    const config = await readConfig()
    return config?.gateway?.auth?.token || ''
  } catch {
    return ''
  }
}

const auth = new Hono()

auth.post('/login', async (c) => {
  const { token } = await c.req.json<{ token: string }>()
  const expected = await getGatewayToken()

  if (!expected || !token || token !== expected) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  return c.json({ ok: true })
})

auth.get('/check', async (c) => {
  const cookie = getCookie(c, COOKIE_NAME)
  const expected = await getGatewayToken()
  const valid = !!expected && !!cookie && cookie === expected
  return c.json({ authenticated: valid })
})

export default auth
