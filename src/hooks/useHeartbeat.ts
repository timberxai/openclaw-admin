import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { heartbeatApi, type HeartbeatSettings } from '@/lib/api'

const HEARTBEAT_KEY = ['heartbeat']

export function useHeartbeat() {
  return useQuery<HeartbeatSettings>({
    queryKey: HEARTBEAT_KEY,
    queryFn: () => heartbeatApi.get(),
  })
}

export function useSaveHeartbeat() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: HeartbeatSettings) => heartbeatApi.save(data),
    onSuccess: (data) => {
      queryClient.setQueryData<HeartbeatSettings>(HEARTBEAT_KEY, data)
    },
  })
}
