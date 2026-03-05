import { useState } from 'react'
import { FileText, Download, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeleteUpload } from '@/hooks/useUploads'
import { uploadsApi, type UploadedFile } from '@/lib/api'

interface FileListProps {
  files: UploadedFile[]
  searchQuery: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

export default function FileList({ files, searchQuery }: FileListProps) {
  const deleteMut = useDeleteUpload()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = searchQuery
    ? files.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : files

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/10 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {searchQuery ? 'No files match your search.' : 'No files uploaded yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {filtered.map((file) => (
        <div
          key={file.name}
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2.5 hover:bg-secondary/30 transition-colors"
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(file.size)} &middot; {formatDate(file.uploadedAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={uploadsApi.getDownloadUrl(file.name)}
              download
              className="inline-flex"
            >
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Download className="size-3.5 text-muted-foreground" />
              </Button>
            </a>
            {confirmDelete === file.name ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                disabled={deleteMut.isPending}
                onClick={() => {
                  deleteMut.mutate(file.name, {
                    onSettled: () => setConfirmDelete(null),
                  })
                }}
              >
                {deleteMut.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  'Confirm?'
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setConfirmDelete(file.name)}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
