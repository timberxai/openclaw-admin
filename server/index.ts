import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import gateway from './routes/gateway.js'
import agents from './routes/agents.js'
import workspace from './routes/workspace.js'
import skills from './routes/skills.js'
import cron from './routes/cron.js'
import channels from './routes/channels.js'
import configRoute from './routes/config.js'
import adminSettingsRoute from './routes/adminSettings.js'

const app = new Hono()
app.use('/*', cors())

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api/gateway', gateway)
app.route('/api/agents', agents)
app.route('/api/workspace', workspace)
app.route('/api/skills', skills)
app.route('/api/cron', cron)
app.route('/api/channels', channels)
app.route('/api/config', configRoute)
app.route('/api/admin-settings', adminSettingsRoute)

// Serve static files from Vite build output in production
app.use('/*', serveStatic({ root: './dist' }))
// SPA fallback: serve index.html for all non-API routes
app.get('/*', serveStatic({ root: './dist', path: 'index.html' }))

const port = Number(process.env.PORT) || 5181
const hostname = process.env.HOST || '0.0.0.0'
console.log(`Hono server running on http://${hostname}:${port}`)
serve({ fetch: app.fetch, port, hostname })
