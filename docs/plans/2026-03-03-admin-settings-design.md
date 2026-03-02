# Admin Settings — Directory Configuration

**Date:** 2026-03-03

## Problem

openclaw-admin needs to know where openclaw's files live (config dir, bundled skills dir).
Currently these paths are hardcoded or read from environment variables, with no way to change them at runtime via the UI.

## Goals

- Allow users to configure directory paths via a Settings page in the admin UI
- Store settings in admin's own config file, completely isolated from openclaw.json
- No impact on openclaw's operation whatsoever
- Changes take effect after admin service restart

## Out of Scope

- Modifying openclaw.json
- Hot reload (restart is acceptable)
- Configuring per-agent workspace paths (already done via agents UI)

## Design

### 1. Admin Settings File

Location: `~/.openclaw-admin/settings.json`

```json
{
  "paths": {
    "configDir": "/Users/foo/.openclaw",
    "bundledSkillsDir": "/Users/foo/openclaw/skills"
  }
}
```

**Priority order** (highest to lowest):
1. Environment variables (`OPENCLAW_CONFIG_DIR`)
2. `~/.openclaw-admin/settings.json`
3. Hardcoded defaults (`~/.openclaw`, `~/openclaw/skills`)

### 2. Backend

**New file: `server/lib/adminSettings.ts`**
- `ADMIN_SETTINGS_DIR = ~/.openclaw-admin`
- `readAdminSettings()` — read and parse settings.json, return defaults if missing
- `writeAdminSettings(settings)` — atomic write with backup

**New file: `server/routes/adminSettings.ts`**
- `GET /api/admin-settings` — return current settings (with resolved effective paths)
- `PUT /api/admin-settings` — validate and save new settings

**Modified: `server/lib/config.ts`**
- `CONFIG_DIR` changes from a module-level constant to a function `getConfigDir()` that reads from adminSettings (env var takes precedence)

**Modified: `server/routes/skills.ts`**
- `getSkillDirs()` reads bundledSkillsDir from adminSettings instead of hardcoding

**Modified: `server/index.ts`**
- Register new `/api/admin-settings` route

### 3. Frontend

**New page: `src/pages/SettingsPage.tsx`**
- Two path input fields: Config Directory, Bundled Skills Directory
- Shows current effective path (resolved from env var or settings)
- Save button → PUT /api/admin-settings
- Info banner: "Changes take effect after restarting the service"
- If path controlled by env var, show read-only with note "Set by environment variable"

**New hook: `src/hooks/useAdminSettings.ts`**
- `useAdminSettings()` — GET query
- `useAdminSettingsSave()` — PUT mutation

**Modified: `src/components/layout/TabNav.tsx`**
- Add Settings tab with Settings icon (last in tab list)

**Modified: `src/App.tsx` (or router)**
- Add route for SettingsPage

## File Changelist

| File | Change |
|------|--------|
| `server/lib/adminSettings.ts` | New |
| `server/routes/adminSettings.ts` | New |
| `src/pages/SettingsPage.tsx` | New |
| `src/hooks/useAdminSettings.ts` | New |
| `server/lib/config.ts` | Modify — CONFIG_DIR becomes dynamic |
| `server/routes/skills.ts` | Modify — read bundledSkillsDir from adminSettings |
| `server/index.ts` | Modify — register new route |
| `src/components/layout/TabNav.tsx` | Modify — add Settings tab |
| `src/App.tsx` | Modify — add Settings route |
| `src/lib/api.ts` | Modify — add adminSettings API calls |
