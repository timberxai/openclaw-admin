# Admin Settings — Directory Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Settings page to openclaw-admin that lets users configure the openclaw config directory and bundled skills directory, stored in admin's own `~/.openclaw-admin/settings.json`.

**Architecture:** New `adminSettings` lib handles read/write of admin's own settings file. Backend exposes GET/PUT `/api/admin-settings`. Frontend adds a Settings tab with two path inputs. `config.ts` and `skills.ts` route read paths dynamically from adminSettings instead of hardcoded values.

**Tech Stack:** Hono (backend), React + TanStack Query (frontend), existing patterns from `useConfig` hook and `configApi`.

---

### Task 1: Create `server/lib/adminSettings.ts`

**Files:**
- Create: `server/lib/adminSettings.ts`

**Step 1: Create the file**

```typescript
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
```

**Step 2: Commit**

```bash
cd /Users/diaojunxian/Documents/github/openclaw-admin
git add server/lib/adminSettings.ts
git commit -m "feat: add adminSettings lib for admin-owned path config"
```

---

### Task 2: Create `server/routes/adminSettings.ts`

**Files:**
- Create: `server/routes/adminSettings.ts`

**Step 1: Create the route file**

```typescript
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
```

**Step 2: Commit**

```bash
git add server/routes/adminSettings.ts
git commit -m "feat: add GET/PUT /api/admin-settings route"
```

---

### Task 3: Register route in `server/index.ts`

**Files:**
- Modify: `server/index.ts`

**Step 1: Add import and route registration**

Add after the existing imports:
```typescript
import adminSettingsRoute from './routes/adminSettings.js'
```

Add after `app.route('/api/config', configRoute)`:
```typescript
app.route('/api/admin-settings', adminSettingsRoute)
```

**Step 2: Commit**

```bash
git add server/index.ts
git commit -m "feat: register /api/admin-settings route"
```

---

### Task 4: Update `server/lib/config.ts` to use dynamic configDir

**Files:**
- Modify: `server/lib/config.ts`

**Step 1: Replace module-level constant with async function**

The current `CONFIG_DIR` is a module-level constant. Replace usages with a dynamic getter.

Replace the top of `server/lib/config.ts`:
```typescript
import { readFile, writeFile, rename, copyFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { getEffectiveConfigDir } from './adminSettings.js'

// Keep for backward compat — callers that already imported CONFIG_DIR
// will be updated in the next step. This is now a function.
export async function getConfigDir(): Promise<string> {
  return getEffectiveConfigDir()
}

// Deprecated: use getConfigDir() instead. Kept temporarily for skills.ts.
export const CONFIG_DIR = process.env.OPENCLAW_CONFIG_DIR || join(homedir(), '.openclaw')
```

Update `readConfig`, `writeConfig`, `getConfigPath` to use `getConfigDir()`:
```typescript
export async function readConfig(): Promise<any> {
  const configDir = await getConfigDir()
  const configPath = join(configDir, 'openclaw.json')
  const raw = await readFile(configPath, 'utf-8')
  return JSON.parse(raw)
}

export async function writeConfig(config: any): Promise<void> {
  const configDir = await getConfigDir()
  const configPath = join(configDir, 'openclaw.json')
  const backupDir = join(configDir, 'backups')
  const json = JSON.stringify(config, null, 2) + '\n'
  JSON.parse(json)

  const tmpPath = configPath + '.tmp'

  await writeFile(tmpPath, json, 'utf-8')

  try {
    await mkdir(backupDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    await copyFile(configPath, join(backupDir, `openclaw-${ts}.json`))
    await pruneBackups(backupDir)
  } catch {
    // non-fatal
  }

  await rename(tmpPath, configPath)
}

export async function getConfigPath(): Promise<string> {
  const configDir = await getConfigDir()
  return join(configDir, 'openclaw.json')
}
```

Update `pruneBackups` to accept `backupDir` parameter:
```typescript
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
    // non-fatal
  }
}
```

**Step 2: Commit**

```bash
git add server/lib/config.ts
git commit -m "feat: make config.ts read configDir dynamically from adminSettings"
```

---

### Task 5: Update `server/routes/config.ts` for async getConfigPath

**Files:**
- Modify: `server/routes/config.ts`

**Step 1: Update import and usage**

`getConfigPath` is now async. Update the import and call site:

```typescript
import { stat } from 'fs/promises'
import { readConfig, getConfigPath } from '../lib/config.js'
```

In the route handler, update:
```typescript
const configPath = await getConfigPath()
```

**Step 2: Commit**

```bash
git add server/routes/config.ts
git commit -m "fix: await async getConfigPath in config route"
```

---

### Task 6: Update `server/routes/skills.ts` to use dynamic dirs

**Files:**
- Modify: `server/routes/skills.ts`

**Step 1: Replace hardcoded dir logic**

Update the import at top of `server/routes/skills.ts`:
```typescript
import { getEffectiveConfigDir, getEffectiveBundledSkillsDir } from '../lib/adminSettings.js'
```

Remove the `CONFIG_DIR` import from `config.js` (keep `readConfig`):
```typescript
import { readConfig } from '../lib/config.js'
```

Update `getSkillDirs` to be async:
```typescript
async function getSkillDirs(config: any, agentWorkspace: string | null) {
  const configDir = await getEffectiveConfigDir()
  const bundledDir = await getEffectiveBundledSkillsDir()
  const sharedDir = join(configDir, 'skills')
  const workspaceDir = agentWorkspace ? join(agentWorkspace, 'skills') : null
  return { bundledDir, sharedDir, workspaceDir, configDir }
}
```

Update all direct `CONFIG_DIR` usages in skills.ts (lines ~203, 256, 295, 321) to use `await getEffectiveConfigDir()` instead.

**Step 2: Commit**

```bash
git add server/routes/skills.ts
git commit -m "feat: skills route reads dirs dynamically from adminSettings"
```

---

### Task 7: Add `adminSettingsApi` to `src/lib/api.ts`

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add types and API object**

Append to `src/lib/api.ts`:
```typescript
// === Admin Settings ===

export interface AdminSettingsPaths {
  configDir: string
  bundledSkillsDir: string
}

export interface AdminSettingsResponse {
  settings: { paths: AdminSettingsPaths }
  effective: AdminSettingsPaths
  envOverrides: { configDir: boolean; bundledSkillsDir: boolean }
}

export const adminSettingsApi = {
  get: () => fetchJSON<AdminSettingsResponse>('/admin-settings'),
  save: (paths: AdminSettingsPaths) =>
    fetchJSON<{ ok: boolean }>('/admin-settings', {
      method: 'PUT',
      body: JSON.stringify({ paths }),
    }),
}
```

**Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add adminSettingsApi to api.ts"
```

---

### Task 8: Create `src/hooks/useAdminSettings.ts`

**Files:**
- Create: `src/hooks/useAdminSettings.ts`

**Step 1: Create the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminSettingsApi, AdminSettingsPaths } from '@/lib/api'

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminSettingsApi.get,
  })
}

export function useAdminSettingsSave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (paths: AdminSettingsPaths) => adminSettingsApi.save(paths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })
}
```

**Step 2: Commit**

```bash
git add src/hooks/useAdminSettings.ts
git commit -m "feat: add useAdminSettings and useAdminSettingsSave hooks"
```

---

### Task 9: Create `src/pages/SettingsPage.tsx`

**Files:**
- Create: `src/pages/SettingsPage.tsx`

**Step 1: Create the page**

```typescript
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Save, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdminSettings, useAdminSettingsSave } from '@/hooks/useAdminSettings'

export default function SettingsPage() {
  const { data, isLoading, error } = useAdminSettings()
  const save = useAdminSettingsSave()

  const [configDir, setConfigDir] = useState('')
  const [bundledSkillsDir, setBundledSkillsDir] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) {
      setConfigDir(data.settings.paths.configDir)
      setBundledSkillsDir(data.settings.paths.bundledSkillsDir)
    }
  }, [data])

  const handleSave = async () => {
    await save.mutateAsync({ configDir, bundledSkillsDir })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        <AlertCircle className="size-4 shrink-0" />
        <span>Failed to load settings: {(error as Error).message}</span>
      </div>
    )
  }

  return (
    <div className="py-8 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure directory paths for openclaw-admin. Stored in ~/.openclaw-admin/settings.json.
        </p>
      </div>

      {/* Restart notice */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
        <Info className="size-4 shrink-0 mt-0.5" />
        <span>Changes take effect after restarting the admin service.</span>
      </div>

      <div className="space-y-5">
        {/* Config Dir */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white">
            openclaw Config Directory
          </Label>
          <p className="text-xs text-muted-foreground">
            Where openclaw.json lives. Effective: <code className="text-blue-300">{data?.effective.configDir}</code>
          </p>
          {data?.envOverrides.configDir ? (
            <div className="flex items-center gap-2">
              <Input value={data.effective.configDir} disabled className="font-mono text-sm opacity-60" />
              <span className="text-xs text-yellow-400 whitespace-nowrap">Set by env var</span>
            </div>
          ) : (
            <Input
              value={configDir}
              onChange={(e) => setConfigDir(e.target.value)}
              placeholder={data?.settings.paths.configDir}
              className="font-mono text-sm"
            />
          )}
        </div>

        {/* Bundled Skills Dir */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white">
            Bundled Skills Directory
          </Label>
          <p className="text-xs text-muted-foreground">
            Where pre-installed skills live. Effective: <code className="text-blue-300">{data?.effective.bundledSkillsDir}</code>
          </p>
          {data?.envOverrides.bundledSkillsDir ? (
            <div className="flex items-center gap-2">
              <Input value={data.effective.bundledSkillsDir} disabled className="font-mono text-sm opacity-60" />
              <span className="text-xs text-yellow-400 whitespace-nowrap">Set by env var</span>
            </div>
          ) : (
            <Input
              value={bundledSkillsDir}
              onChange={(e) => setBundledSkillsDir(e.target.value)}
              placeholder={data?.settings.paths.bundledSkillsDir}
              className="font-mono text-sm"
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={save.isPending}
          className="gap-2"
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save Settings
        </Button>
        {saved && (
          <span className="text-sm text-green-400">Saved! Restart the service to apply.</span>
        )}
        {save.isError && (
          <span className="text-sm text-red-400">Save failed: {(save.error as Error).message}</span>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add SettingsPage for directory path configuration"
```

---

### Task 10: Add Settings tab to `src/components/layout/TabNav.tsx`

**Files:**
- Modify: `src/components/layout/TabNav.tsx`

**Step 1: Add import and tab entry**

Add import at top:
```typescript
import SettingsPage from "@/pages/SettingsPage"
```

In the `tabs` array, replace the existing `config` entry — Settings replaces the `Settings` icon currently used on Config. Use `SlidersHorizontal` for Settings and keep `Settings` for Config:

Update the import line:
```typescript
import { Users, Wrench, MessageSquare, Clock, Settings, SlidersHorizontal } from "lucide-react"
```

Update `tabs` array to add Settings at the end:
```typescript
const tabs = [
  { value: "agents", label: "Agents", icon: Users },
  { value: "skills", label: "Skills", icon: Wrench },
  { value: "channels", label: "Channels", icon: MessageSquare },
  { value: "cron", label: "Cron", icon: Clock },
  { value: "config", label: "Config", icon: Settings },
  { value: "settings", label: "Settings", icon: SlidersHorizontal },
] as const
```

Add TabsContent at the end:
```tsx
<TabsContent value="settings"><SettingsPage /></TabsContent>
```

**Step 2: Commit**

```bash
git add src/components/layout/TabNav.tsx
git commit -m "feat: add Settings tab to TabNav"
```

---

### Task 11: Smoke test end-to-end

**Step 1: Build and start the server**

```bash
cd /Users/diaojunxian/Documents/github/openclaw-admin
npm run dev
```

**Step 2: Verify GET endpoint returns defaults**

```bash
curl http://localhost:5181/api/admin-settings | jq .
```

Expected: JSON with `settings.paths`, `effective`, `envOverrides`

**Step 3: Open browser → Settings tab**

- Both fields should show current paths
- Change a value and click Save
- Check `~/.openclaw-admin/settings.json` was created

**Step 4: Verify env var override**

```bash
OPENCLAW_CONFIG_DIR=/tmp/test npm run dev
```

- Settings page should show the field as read-only with "Set by env var"

**Step 5: Verify skills still load**

Navigate to Skills tab — skills should still load from the configured path.

**Step 6: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: smoke test fixups for admin settings"
```
