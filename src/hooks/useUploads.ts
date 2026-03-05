import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadsApi, type UploadedFile } from '@/lib/api'

export function useUploads() {
  return useQuery<UploadedFile[]>({
    queryKey: ['uploads'],
    queryFn: () => uploadsApi.list(),
  })
}

export function useUploadFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, overwrite }: { file: File; overwrite?: boolean }) =>
      uploadsApi.upload(file, overwrite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
    },
  })
}

export function useDeleteUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (filename: string) => uploadsApi.remove(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
    },
  })
}
