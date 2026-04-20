import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import MarkdownEditor from '@/components/editor/MarkdownEditor'
import { useHeartbeat, useSaveHeartbeat } from '@/hooks/useHeartbeat'
import { useWorkspaceFile, useWorkspaceFileSave } from '@/hooks/useWorkspaceFile'
import type { HeartbeatConfig } from '@/lib/api'

export default function HeartbeatPanel() {
  const { data, isLoading } = useHeartbeat()
  const saveHeartbeat = useSaveHeartbeat()

  const [cfg, setCfg] = useState<HeartbeatConfig>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data) {
      setCfg(data.defaults ?? {})
      setDirty(false)
    }
  }, [data])

  function update<K extends keyof HeartbeatConfig>(key: K, value: HeartbeatConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function handleSaveConfig() {
    saveHeartbeat.mutate({ defaults: cfg }, { onSuccess: () => setDirty(false) })
  }

  // HEARTBEAT.md editor
  const { data: fileData } = useWorkspaceFile('HEARTBEAT.md')
  const saveFile = useWorkspaceFileSave()
  const [mdContent, setMdContent] = useState('')
  const [mdDirty, setMdDirty] = useState(false)

  useEffect(() => {
    if (fileData) {
      setMdContent(fileData.content)
      setMdDirty(false)
    }
  }, [fileData])

  function handleSaveMd() {
    saveFile.mutate(
      { name: 'HEARTBEAT.md', content: mdContent },
      { onSuccess: () => setMdDirty(false) }
    )
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-8">
      {/* Config section */}
      <section className="rounded-lg border border-border/50 bg-secondary/20 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Default Config</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Interval (every)</span>
            <Input
              value={cfg.every ?? ''}
              onChange={(e) => update('every', e.target.value || undefined)}
              placeholder="30m  (empty = use openclaw default)"
              className="h-8 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Target</span>
            <Input
              value={cfg.target ?? ''}
              onChange={(e) => update('target', e.target.value || undefined)}
              placeholder="none / last / whatsapp / telegram …"
              className="h-8 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Active hours start (HH:MM)</span>
            <Input
              value={cfg.activeHours?.start ?? ''}
              onChange={(e) => {
                const start = e.target.value
                update('activeHours', start ? { ...(cfg.activeHours ?? { end: '24:00' }), start } : undefined)
              }}
              placeholder="08:00"
              className="h-8 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Active hours end (HH:MM)</span>
            <Input
              value={cfg.activeHours?.end ?? ''}
              onChange={(e) => {
                const end = e.target.value
                update('activeHours', end ? { ...(cfg.activeHours ?? { start: '08:00' }), end } : undefined)
              }}
              placeholder="24:00"
              className="h-8 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={cfg.isolatedSession ?? false}
              onCheckedChange={(v) => update('isolatedSession', v)}
            />
            Isolated session
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={cfg.lightContext ?? false}
              onCheckedChange={(v) => update('lightContext', v)}
            />
            Light context
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={cfg.includeReasoning ?? false}
              onCheckedChange={(v) => update('includeReasoning', v)}
            />
            Include reasoning
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={!dirty || saveHeartbeat.isPending}
            onClick={handleSaveConfig}
          >
            <Save className="mr-1 size-3.5" />
            {saveHeartbeat.isPending ? 'Saving…' : 'Save config'}
          </Button>
        </div>
      </section>

      {/* HEARTBEAT.md editor */}
      <section className="rounded-lg border border-border/50 bg-secondary/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">HEARTBEAT.md</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Only <code className="text-blue-400">#</code> comment lines → openclaw skips the API call entirely
            </p>
          </div>
          <Button
            size="sm"
            disabled={!mdDirty || saveFile.isPending}
            onClick={handleSaveMd}
          >
            <Save className="mr-1 size-3.5" />
            {saveFile.isPending ? 'Saving…' : 'Save file'}
          </Button>
        </div>
        <MarkdownEditor
          value={mdContent}
          onChange={(v) => { setMdContent(v); setMdDirty(true) }}
          onSave={handleSaveMd}
        />
      </section>
    </div>
  )
}
