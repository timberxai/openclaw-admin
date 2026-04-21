import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { skillsApi, type Skill } from '@/lib/api'
import { Button } from '@/components/ui/button'
import MarkdownRenderer from '@/components/MarkdownRenderer'

export default function SkillDetailPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const skillFromState = (location.state as { skill?: Skill } | null)?.skill

  const [skill, setSkill] = useState<Skill | null>(skillFromState ?? null)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If no skill from state, fetch basic info from content endpoint
  useEffect(() => {
    if (!name) return
    if (skillFromState) {
      setSkill(skillFromState)
      return
    }
    let cancelled = false
    skillsApi.getContent(name)
      .then((r) => {
        if (cancelled) return
        // Build a minimal Skill object from content response
        setSkill({
          name: r.name,
          description: '',
          group: 'general',
          hasConfig: false,
          source: 'shared',
        })
      })
      .catch(() => {
        if (!cancelled) setError('Skill not found')
      })
    return () => { cancelled = true }
  }, [name, skillFromState])

  useEffect(() => {
    if (!name) return
    let cancelled = false
    setAllFiles([])
    setCurrentPath('')
    setFileContent(null)
    setError(null)

    skillsApi.getFiles(name)
      .then((r) => { if (!cancelled) setAllFiles(r.files) })
      .catch((e) => { if (!cancelled) setError(e.message) })

    return () => { cancelled = true }
  }, [name])

  const listing = useMemo(() => {
    const prefix = currentPath ? currentPath + '/' : ''
    const dirs = new Set<string>()
    const files: string[] = []

    for (const f of allFiles) {
      if (!f.startsWith(prefix)) continue
      const rest = f.slice(prefix.length)
      const slashIdx = rest.indexOf('/')
      if (slashIdx >= 0) {
        dirs.add(rest.slice(0, slashIdx))
      } else {
        files.push(rest)
      }
    }

    return {
      dirs: [...dirs].sort(),
      files: files.sort(),
    }
  }, [allFiles, currentPath])

  const breadcrumbs = currentPath ? currentPath.split('/') : []

  const handleNavigate = (dir: string) => {
    setCurrentPath(currentPath ? `${currentPath}/${dir}` : dir)
    setFileContent(null)
    setFileError(null)
  }

  const handleBreadcrumb = (idx: number) => {
    if (idx < 0) {
      setCurrentPath('')
    } else {
      setCurrentPath(breadcrumbs.slice(0, idx + 1).join('/'))
    }
    setFileContent(null)
    setFileError(null)
  }

  const handleFileClick = async (fileName: string) => {
    if (!name) return
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName
    setLoadingFile(true)
    setFileContent(null)
    setFileError(null)
    try {
      const result = await skillsApi.getFileContent(name, fullPath)
      setFileContent(result.content)
      setCurrentPath(fullPath)
    } catch {
      setFileError('(Failed to load file)')
    } finally {
      setLoadingFile(false)
    }
  }

  const isViewingFile = fileContent !== null

  const ext = currentPath.split('.').pop()?.toLowerCase() || ''
  const isMd = ext === 'md' || ext === 'mdx'

  if (error) {
    return (
      <div className="space-y-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/skills')} className="gap-1.5">
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!skill || !name) {
    return <p className="text-muted-foreground py-8 text-center">Loading...</p>
  }

  return (
    <div className="space-y-4 py-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/skills')} className="gap-1.5">
        <ArrowLeft className="size-3.5" />
        Back to Skills
      </Button>

      {/* Header */}
      <div className="rounded-xl border border-border/40 bg-secondary/40 p-4">
        <h1 className="text-lg font-bold text-white">{skill.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {skill.description || 'No description'}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {skill.source}
          </span>
          {skill.agentId && (
            <span className="text-[10px] text-muted-foreground">agent: {skill.agentId}</span>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="rounded-t-xl border border-b-0 border-border/40 bg-secondary/30 px-3 py-2 flex items-center gap-1 text-sm">
        <button
          onClick={() => handleBreadcrumb(-1)}
          className={`hover:underline cursor-pointer ${currentPath ? 'text-blue-400' : 'text-white font-medium'}`}
        >
          {skill.name}
        </button>
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground">/</span>
            {i < breadcrumbs.length - 1 ? (
              <button
                onClick={() => handleBreadcrumb(i)}
                className="text-blue-400 hover:underline cursor-pointer"
              >
                {part}
              </button>
            ) : (
              <span className="text-white font-medium">{part}</span>
            )}
          </span>
        ))}
      </div>

      {/* Content area */}
      <div className="rounded-b-xl border border-border/40 bg-secondary/20 overflow-hidden">
        {isViewingFile ? (
          <div>
            <div className="border-b border-border/40 px-3 py-2 bg-secondary/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">{currentPath}</span>
            </div>
            <div className="p-4 max-h-[60vh] overflow-auto">
              {loadingFile ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : fileError ? (
                <p className="text-sm text-destructive">{fileError}</p>
              ) : isMd ? (
                <MarkdownRenderer content={fileContent || ''} />
              ) : (
                <pre className="text-sm text-gray-300 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">{fileContent}</pre>
              )}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/40">
              {currentPath && (
                <tr
                  className="hover:bg-secondary/40 cursor-pointer"
                  onClick={() => handleBreadcrumb(breadcrumbs.length - 2)}
                >
                  <td className="px-3 py-2 text-muted-foreground">..</td>
                </tr>
              )}
              {listing.dirs.map((dir) => (
                <tr
                  key={dir}
                  className="hover:bg-secondary/40 cursor-pointer"
                  onClick={() => handleNavigate(dir)}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-400">
                        <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75Z" />
                        <path d="M3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z" />
                      </svg>
                      {dir}
                    </span>
                  </td>
                </tr>
              ))}
              {listing.files.map((file) => (
                <tr
                  key={file}
                  className="hover:bg-secondary/40 cursor-pointer"
                  onClick={() => handleFileClick(file)}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-500">
                        <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
                      </svg>
                      {file}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
