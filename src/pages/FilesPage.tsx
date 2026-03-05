import FilesBrowser from '@/components/files/FilesBrowser'

export default function FilesPage() {
  return (
    <div className="py-8">
      <h2 className="text-lg font-semibold text-white">Files</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Upload and manage files in the workspace. Uploaded files can be accessed by agents during chat.
      </p>
      <FilesBrowser />
    </div>
  )
}
