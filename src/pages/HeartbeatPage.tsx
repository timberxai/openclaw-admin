import { Activity } from 'lucide-react'
import HeartbeatPanel from '@/components/heartbeat/HeartbeatPanel'

export default function HeartbeatPage() {
  return (
    <div className="py-8">
      <div className="mb-6 flex items-center gap-2">
        <Activity className="size-5 text-blue-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">Heartbeat</h2>
          <p className="text-sm text-muted-foreground">
            Configure periodic agent check-ins and edit the heartbeat checklist
          </p>
        </div>
      </div>
      <HeartbeatPanel />
    </div>
  )
}
