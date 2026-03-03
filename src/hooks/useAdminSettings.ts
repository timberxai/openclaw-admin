import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminSettingsApi, type AdminSettingsPaths } from '@/lib/api'

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
