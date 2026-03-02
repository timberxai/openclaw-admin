import { readFile, writeFile, rename, copyFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { getEffectiveConfigDir } from './adminSettings.js'

const MAX_BACKUPS = 10

export async function getConfigDir(): Promise<string> {
  return getEffectiveConfigDir()
}

export async function readConfig(): Promise<any> {
  const configDir = await getConfigDir()
  const configPath = join(configDir, 'openclaw.json')
  const raw = await readFile(configPath, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Write config atomically: write to temp → backup current → rename temp over original.
 * Keeps up to MAX_BACKUPS timestamped backups in <configDir>/backups/.
 */
export async function writeConfig(config: any): Promise<void> {
  const configDir = await getConfigDir()
  const configPath = join(configDir, 'openclaw.json')
  const backupDir = join(configDir, 'backups')
  const json = JSON.stringify(config, null, 2) + '\n'

  // Validate JSON roundtrips cleanly before touching disk
  JSON.parse(json)

  const tmpPath = configPath + '.tmp'

  // 1. Write to temp file
  await writeFile(tmpPath, json, 'utf-8')

  // 2. Backup current config
  try {
    await mkdir(backupDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    await copyFile(configPath, join(backupDir, `openclaw-${ts}.json`))
    await pruneBackups(backupDir)
  } catch {
    // Backup failure is non-fatal — don't block the write
  }

  // 3. Atomic rename (same filesystem = atomic on POSIX)
  await rename(tmpPath, configPath)
}

/**
 * Keep only the most recent MAX_BACKUPS files.
 */
async function pruneBackups(backupDir: string): Promise<void> {
  try {
    const { readdir, unlink } = await import('fs/promises')
    const files = (await readdir(backupDir))
      .filter((f) => f.startsWith('openclaw-') && f.endsWith('.json'))
      .sort()

    while (files.length > MAX_BACKUPS) {
      const oldest = files.shift()!
      await unlink(join(backupDir, oldest)).catch(() => {})
    }
  } catch {
    // Non-fatal
  }
}

export async function getConfigPath(): Promise<string> {
  const configDir = await getConfigDir()
  return join(configDir, 'openclaw.json')
}
