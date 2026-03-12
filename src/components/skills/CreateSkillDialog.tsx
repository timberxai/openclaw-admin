import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Pencil, Loader2, FolderUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSkillCreate, useSkillContent, useSkillUpdate, useSkillImport } from '@/hooks/useSkills'
import type { Skill } from '@/lib/api'

const SKILL_TEMPLATE = `---
name:
description:
group: general
---

# Skill Name

Instructions here...
`

interface ImportedFile {
  path: string
  content: string
}

interface CreateSkillDialogProps {
  /** When set, dialog opens in edit mode for this skill */
  editSkill?: Skill | null
  /** External open state control for edit mode */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function CreateSkillDialog({
  editSkill,
  open: controlledOpen,
  onOpenChange,
}: CreateSkillDialogProps) {
  const isEditMode = !!editSkill
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const createMut = useSkillCreate()
  const updateMut = useSkillUpdate()
  const importMut = useSkillImport()
  const { data: existingContent } = useSkillContent(
    isEditMode && open ? editSkill.name : null,
    editSkill?.source as 'shared' | 'workspace' | undefined,
    editSkill?.agentId
  )

  // Form state
  const [name, setName] = useState('')
  const [content, setContent] = useState(SKILL_TEMPLATE)
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Populate content when editing
  useEffect(() => {
    if (isEditMode && existingContent) {
      setName(editSkill.name)
      setContent(existingContent.content)
    }
  }, [isEditMode, editSkill, existingContent])

  const resetForm = useCallback(() => {
    setName('')
    setContent(SKILL_TEMPLATE)
    setImportedFiles([])
    createMut.reset()
    updateMut.reset()
    importMut.reset()
  }, [createMut, updateMut, importMut])

  // Handle folder selection
  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files: ImportedFile[] = []
    // Extract folder name from the first file's webkitRelativePath
    const firstPath = fileList[0].webkitRelativePath
    const folderName = firstPath.split('/')[0]

    for (const file of Array.from(fileList)) {
      // Skip hidden files and directories
      const relativePath = file.webkitRelativePath
      if (relativePath.split('/').some((p) => p.startsWith('.'))) continue
      // Skip binary files by checking common extensions
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'zip', 'tar', 'gz']
      if (binaryExts.includes(ext)) continue

      try {
        const text = await file.text()
        // Store path relative to the folder (strip folder prefix)
        const pathInFolder = relativePath.split('/').slice(1).join('/')
        files.push({ path: pathInFolder, content: text })
      } catch {
        // Skip files that can't be read as text
      }
    }

    setImportedFiles(files)
    if (!name) setName(folderName)

    // Show SKILL.md content in the textarea if it exists
    const skillMd = files.find((f) => f.path === 'SKILL.md')
    if (skillMd) {
      setContent(skillMd.content)
    }

    // Reset file input so re-selecting same folder works
    e.target.value = ''
  }, [name])

  const hasExtraFiles = importedFiles.filter((f) => f.path !== 'SKILL.md').length > 0

  const canSubmit = isEditMode
    ? content.trim().length > 0 && content.includes('---')
    : name.trim().length > 0 && content.trim().length > 0 && content.includes('---')

  const activeMut = isEditMode ? updateMut : (hasExtraFiles ? importMut : createMut)

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return

    if (isEditMode) {
      updateMut.mutate(
        {
          skillName: editSkill!.name,
          content,
          source: editSkill!.source,
          agentId: editSkill!.agentId,
        },
        {
          onSuccess: () => {
            resetForm()
            setOpen(false)
          },
        }
      )
    } else if (hasExtraFiles) {
      // Import mode: send all files including updated SKILL.md
      const filesToSend = importedFiles
        .filter((f) => f.path !== 'SKILL.md')
        .concat([{ path: 'SKILL.md', content }])
      importMut.mutate(
        { name: name.trim(), files: filesToSend },
        {
          onSuccess: () => {
            resetForm()
            setOpen(false)
          },
        }
      )
    } else {
      createMut.mutate(
        { name: name.trim(), content },
        {
          onSuccess: () => {
            resetForm()
            setOpen(false)
          },
        }
      )
    }
  }, [canSubmit, isEditMode, editSkill, name, content, importedFiles, hasExtraFiles, createMut, updateMut, importMut, resetForm, setOpen])

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) resetForm()
  }

  const dialogContent = (
    <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col gap-0 bg-card border-border/50">
      <DialogHeader className="shrink-0">
        <DialogTitle>{isEditMode ? 'Edit Skill' : 'Create Skill'}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-3 mt-2 min-h-0 flex-1">
        {/* Skill Name + Import row */}
        {!isEditMode && (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Skill Name (directory name)
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-custom-skill"
                className="mt-1 bg-secondary/50 font-mono text-sm"
              />
            </div>
            <div>
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is non-standard
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handleFolderSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 whitespace-nowrap"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderUp className="size-3.5" />
                Import Folder
              </Button>
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="shrink-0">
            <label className="text-xs font-medium text-muted-foreground">Skill</label>
            <p className="mt-0.5 text-sm font-mono text-white">
              {editSkill!.name}
              {editSkill!.agentId && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (agent: {editSkill!.agentId})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Imported files summary */}
        {importedFiles.length > 0 && (
          <div className="shrink-0 rounded-md border border-border/50 bg-secondary/30 px-3 py-2 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-1 sticky top-0 bg-secondary/30">
              Imported {importedFiles.length} file{importedFiles.length !== 1 ? 's' : ''}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {importedFiles.map((f) => (
                <span
                  key={f.path}
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono ${
                    f.path === 'SKILL.md'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-zinc-500/15 text-zinc-400'
                  }`}
                >
                  {f.path}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SKILL.md Content — takes remaining space */}
        <div className="flex flex-col min-h-0 flex-1">
          <label className="text-xs font-medium text-muted-foreground shrink-0">SKILL.md Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="---\nname: My Skill\ndescription: ...\n---\n\nInstructions..."
            className="mt-1 w-full flex-1 min-h-0 resize-none rounded-lg border border-border/50 bg-secondary/50 p-3 text-sm font-mono text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            spellCheck={false}
          />
        </div>

        {/* Error */}
        {activeMut.isError && (
          <p className="text-xs text-destructive shrink-0">
            Failed: {activeMut.error?.message ?? 'Unknown error'}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || activeMut.isPending}
            className="gap-1.5"
          >
            {activeMut.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {isEditMode ? 'Saving...' : hasExtraFiles ? 'Importing...' : 'Creating...'}
              </>
            ) : (
              <>
                {isEditMode ? (
                  <Pencil className="size-3.5" />
                ) : hasExtraFiles ? (
                  <FolderUp className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                {isEditMode ? 'Save' : hasExtraFiles ? 'Import Skill' : 'Create Skill'}
              </>
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  )

  // Edit mode: controlled externally, no trigger
  if (isEditMode) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {dialogContent}
      </Dialog>
    )
  }

  // Create mode: self-contained with trigger button
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Create Skill
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  )
}
