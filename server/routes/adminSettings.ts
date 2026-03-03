import { Hono } from 'hono'
import {
  readAdminSettings,
  writeAdminSettings,
  getEffectiveConfigDir,
} from '../lib/adminSettings.js'

const adminSettingsRoute = new Hono()

// GET /api/admin-settings
adminSettingsRoute.get('/', async (c) => {
  try {
    const settings = await readAdminSettings()
    const effectiveConfigDir = await getEffectiveConfigDir()

    return c.json({
      settings,
      effective: {
        configDir: effectiveConfigDir,
      },
      envOverrides: {
        configDir: process.env.OPENCLAW_CONFIG_DIR || null,
      },
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PUT /api/admin-settings
adminSettingsRoute.put('/', async (c) => {
  try {
    const body = await c.req.json()
    if (!body?.paths?.configDir) {
      return c.json({ error: 'paths.configDir is required' }, 400)
    }
    await writeAdminSettings({
      paths: {
        configDir: body.paths.configDir,
      },
    })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default adminSettingsRoute
