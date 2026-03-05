import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useUploads } from '@/hooks/useUploads'
import FileList from './FileList'
import UploadFileDialog from './UploadFileDialog'

export default function FilesBrowser() {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: files, isLoading, isError, error } = useUploads()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 flex-1 animate-pulse rounded-md bg-secondary/50" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/50" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">
          Failed to load files: {error?.message ?? 'Unknown error'}
        </p>
      </div>
    )
  }

  const fileList = files ?? []

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <UploadFileDialog />
      </div>

      {/* Summary */}
      <p className="text-xs text-muted-foreground">
        {fileList.length} file{fileList.length !== 1 ? 's' : ''} uploaded
        {searchQuery && (
          <span>
            {' '}&middot; filtering by "<span className="text-white">{searchQuery}</span>"
          </span>
        )}
      </p>

      {/* File list */}
      <FileList files={fileList} searchQuery={searchQuery} />
    </div>
  )
}
