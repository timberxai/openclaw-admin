import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Save, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminSettings, useAdminSettingsSave } from '@/hooks/useAdminSettings'

export default function SettingsPage() {
  const { data, isLoading, error } = useAdminSettings()
  const save = useAdminSettingsSave()

  const [configDir, setConfigDir] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) {
      setConfigDir(data.settings.paths.configDir)
    }
  }, [data])

  const handleSave = async () => {
    await save.mutateAsync({ configDir })
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
          Configure the openclaw config directory. All agent info, workspaces, and skills are derived from the openclaw.json in this directory.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
        <Info className="size-4 shrink-0 mt-0.5" />
        <span>Changes take effect after restarting the admin service.</span>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">
          openclaw Config Directory
        </label>
        <p className="text-xs text-muted-foreground">
          Directory containing openclaw.json. Current effective path: <code className="text-blue-300">{data?.effective.configDir}</code>
        </p>
        {data?.envOverrides.configDir && (
          <p className="text-xs text-yellow-400">
            Env var OPENCLAW_CONFIG_DIR is set to: <code>{data.envOverrides.configDir}</code>. Saving here will override it.
          </p>
        )}
        <Input
          value={configDir}
          onChange={(e) => setConfigDir(e.target.value)}
          placeholder={data?.effective.configDir}
          className="font-mono text-sm"
        />
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
