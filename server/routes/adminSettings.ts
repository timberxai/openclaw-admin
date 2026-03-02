import { Hono } from 'hono'
import {
  readAdminSettings,
  writeAdminSettings,
  getEffectiveConfigDir,
  getEffectiveBundledSkillsDir,
} from '../lib/adminSettings.js'

const adminSettingsRoute = new Hono()

// GET /api/admin-settings
adminSettingsRoute.get('/', async (c) => {
  try {
    const settings = await readAdminSettings()
    const effectiveConfigDir = await getEffectiveConfigDir()
    const effectiveBundledSkillsDir = await getEffectiveBundledSkillsDir()

    return c.json({
      settings,
      effective: {
        configDir: effectiveConfigDir,
        bundledSkillsDir: effectiveBundledSkillsDir,
      },
      envOverrides: {
        configDir: !!process.env.OPENCLAW_CONFIG_DIR,
        bundledSkillsDir: !!process.env.OPENCLAW_BUNDLED_SKILLS_DIR,
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
    if (!body?.paths?.configDir || !body?.paths?.bundledSkillsDir) {
      return c.json({ error: 'paths.configDir and paths.bundledSkillsDir are required' }, 400)
    }
    await writeAdminSettings({
      paths: {
        configDir: body.paths.configDir,
        bundledSkillsDir: body.paths.bundledSkillsDir,
      },
    })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default adminSettingsRoute
