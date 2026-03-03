import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export const ADMIN_SETTINGS_DIR = join(homedir(), '.openclaw-admin')
const ADMIN_SETTINGS_PATH = join(ADMIN_SETTINGS_DIR, 'settings.json')

export interface AdminSettings {
  paths: {
    configDir: string
  }
}

function getDefaults(): AdminSettings {
  const home = homedir()
  return {
    paths: {
      configDir: join(home, '.openclaw'),
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
      },
    }
  } catch {
    return getDefaults()
  }
}

/**
 * Read the raw saved configDir from settings file, or null if not saved.
 */
async function readSavedConfigDir(): Promise<string | null> {
  try {
    const raw = await readFile(ADMIN_SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed?.paths?.configDir || null
  } catch {
    return null
  }
}

export async function writeAdminSettings(settings: AdminSettings): Promise<void> {
  await mkdir(ADMIN_SETTINGS_DIR, { recursive: true })
  const json = JSON.stringify(settings, null, 2) + '\n'
  JSON.parse(json) // validate
  await writeFile(ADMIN_SETTINGS_PATH, json, 'utf-8')
}

/**
 * Resolve effective configDir: settings file > env var > default.
 * User-saved value takes priority over env var.
 */
export async function getEffectiveConfigDir(): Promise<string> {
  const saved = await readSavedConfigDir()
  if (saved) return saved
  if (process.env.OPENCLAW_CONFIG_DIR) return process.env.OPENCLAW_CONFIG_DIR
  return getDefaults().paths.configDir
}

