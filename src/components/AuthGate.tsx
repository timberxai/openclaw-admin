import { useState, useEffect, type ReactNode } from 'react'

const AUTH_CHECK_URL = '/api/auth/check'
const AUTH_LOGIN_URL = '/api/auth/login'

function extractHashToken(): string | null {
  const hash = window.location.hash
  if (!hash) return null
  const match = hash.match(/token=([^&]+)/)
  return match ? match[1] : null
}

function clearHash() {
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname)
  }
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'authenticated' | 'login'>('checking')
  const [error, setError] = useState('')
  const [tokenInput, setTokenInput] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const res = await fetch(AUTH_CHECK_URL)
      const data = await res.json()
      if (data.authenticated) {
        clearHash()
        setState('authenticated')
        return
      }
    } catch { /* ignore */ }

    const hashToken = extractHashToken()
    if (hashToken) {
      await loginWithToken(hashToken)
    } else {
      setState('login')
    }
  }

  async function loginWithToken(token: string) {
    setError('')
    try {
      const res = await fetch(AUTH_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        clearHash()
        setState('authenticated')
      } else {
        setError('Invalid token')
        setState('login')
      }
    } catch {
      setError('Connection failed')
      setState('login')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tokenInput.trim()) loginWithToken(tokenInput.trim())
  }

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Checking authentication...
      </div>
    )
  }

  if (state === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-950/40 via-background to-purple-950/40">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
          <h1 className="text-xl font-semibold text-center text-foreground">OpenClaw Admin</h1>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Enter token"
            autoFocus
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Login
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
