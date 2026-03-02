import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export const ADMIN_SETTINGS_DIR = join(homedir(), '.openclaw-admin')
const ADMIN_SETTINGS_PATH = join(ADMIN_SETTINGS_DIR, 'settings.json')

export interface AdminSettings {
  paths: {
    configDir: string
    bundledSkillsDir: string
  }
}

function getDefaults(): AdminSettings {
  const home = homedir()
  return {
    paths: {
      configDir: join(home, '.openclaw'),
      bundledSkillsDir: join(home, 'openclaw', 'skills'),
    },
  }
}

export async function readAdminSettings(): Promise<AdminSettings> {
  try {
    const raw = await readFile(ADMIN_SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    const defaults = getDefaults()
    return {
      paths: {
        configDir: parsed?.paths?.configDir || defaults.paths.configDir,
        bundledSkillsDir: parsed?.paths?.bundledSkillsDir || defaults.paths.bundledSkillsDir,
      },
    }
  } catch {
    return getDefaults()
  }
}

export async function writeAdminSettings(settings: AdminSettings): Promise<void> {
  await mkdir(ADMIN_SETTINGS_DIR, { recursive: true })
  const json = JSON.stringify(settings, null, 2) + '\n'
  JSON.parse(json) // validate
  await writeFile(ADMIN_SETTINGS_PATH, json, 'utf-8')
}

/**
 * Resolve effective configDir: env var takes priority over settings file.
 */
export async function getEffectiveConfigDir(): Promise<string> {
  if (process.env.OPENCLAW_CONFIG_DIR) return process.env.OPENCLAW_CONFIG_DIR
  const settings = await readAdminSettings()
  return settings.paths.configDir
}

/**
 * Resolve effective bundledSkillsDir: env var takes priority.
 */
export async function getEffectiveBundledSkillsDir(): Promise<string> {
  if (process.env.OPENCLAW_BUNDLED_SKILLS_DIR) return process.env.OPENCLAW_BUNDLED_SKILLS_DIR
  const settings = await readAdminSettings()
  return settings.paths.bundledSkillsDir
}
