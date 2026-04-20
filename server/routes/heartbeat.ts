import { Hono } from 'hono'
import { readConfig, writeConfig } from '../lib/config.js'

const heartbeat = new Hono()

// GET /api/heartbeat — return agents.defaults.heartbeat config
heartbeat.get('/', async (c) => {
  try {
    const config = await readConfig()
    return c.json({ defaults: config?.agents?.defaults?.heartbeat ?? {} })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PUT /api/heartbeat — update agents.defaults.heartbeat config
heartbeat.put('/', async (c) => {
  try {
    const body = await c.req.json<{ defaults: Record<string, unknown> }>()
    if (!body || typeof body.defaults !== 'object') {
      return c.json({ error: 'Missing or invalid "defaults" in request body' }, 400)
    }

    const config = await readConfig()
    if (!config.agents) config.agents = {}
    if (!config.agents.defaults) config.agents.defaults = {}
    config.agents.defaults.heartbeat = body.defaults
    await writeConfig(config)

    return c.json({ defaults: config.agents.defaults.heartbeat })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default heartbeat
