import { Hono } from 'hono'
import { readdir, readFile, writeFile, mkdir, rm } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { readConfig } from '../lib/config.js'
import { getEffectiveConfigDir } from '../lib/adminSettings.js'
import { getAgentWorkspace } from '../lib/agents.js'

const skills = new Hono()

type SkillSource = 'bundled' | 'shared' | 'workspace'

interface SkillInfo {
  name: string
  description: string
  group: string
  hasConfig: boolean
  source: SkillSource
  agentId?: string  // set when source is 'workspace'
}

/**
 * Parse YAML-ish frontmatter between --- markers.
 * Handles simple `key: value` and multi-line `key: |` blocks.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const result: Record<string, string> = {}
  const lines = match[1].split(/\r?\n/)
  let currentKey: string | null = null
  let currentValue: string[] = []

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (kvMatch) {
      if (currentKey) {
        result[currentKey] = currentValue.join('\n').trim()
      }
      currentKey = kvMatch[1]
      const val = kvMatch[2]
      if (val === '|' || val === '>') {
        currentValue = []
      } else {
        currentValue = [val.replace(/^["']|["']$/g, '')]
      }
    } else if (currentKey && (line.startsWith('  ') || line === '')) {
      currentValue.push(line.replace(/^ {2}/, ''))
    }
  }
  if (currentKey) {
    result[currentKey] = currentValue.join('\n').trim()
  }

  return result
}

/**
 * Scan a directory for skills (folders containing SKILL.md).
 */
async function scanSkillsDir(
  dir: string,
  source: SkillSource,
  skillEntries: Record<string, unknown>,
  agentId?: string
): Promise<SkillInfo[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const results: SkillInfo[] = []

  for (const entry of entries) {
    const skillMdPath = join(dir, entry, 'SKILL.md')
    let raw: string
    try {
      raw = await readFile(skillMdPath, 'utf-8')
    } catch {
      continue
    }

    const fm = parseFrontmatter(raw)
    const name = fm.name || entry
    const description = fm.description || ''
    const group = fm.group || fm.category || 'general'
    const hasConfig = entry in skillEntries || name in skillEntries

    results.push({ name, description, group, hasConfig, source, agentId })
  }

  return results
}

/**
 * Resolve the three skill directories.
 */
async function getSkillDirs(config: any, agentWorkspace: string | null) {
  const configDir = await getEffectiveConfigDir()
  const sharedDir = join(configDir, 'skills')
  const workspaceDir = agentWorkspace ? join(agentWorkspace, 'skills') : null
  return { sharedDir, workspaceDir, configDir }
}

// GET /api/skills — list all skills, optionally scoped to an agent
skills.get('/', async (c) => {
  try {
    const config = await readConfig()
    const agentId = c.req.query('agentId')
    const skillEntries: Record<string, unknown> = config?.skills?.entries ?? {}
    const { sharedDir } = await getSkillDirs(config, null)

    // Scan shared skills
    const sharedSkills = await scanSkillsDir(sharedDir, 'shared', skillEntries)

    // Scan workspace skills
    let allWorkspaceSkills: SkillInfo[] = []
    if (agentId) {
      // Single agent
      const ws = getAgentWorkspace(config, agentId)
      if (ws) {
        allWorkspaceSkills = await scanSkillsDir(
          join(ws, 'skills'), 'workspace', skillEntries, agentId
        )
      }
    } else {
      // No agentId — scan ALL agents' workspaces
      const agentsList: any[] = config.agents?.list ?? []
      if (agentsList.length > 0) {
        const scans = agentsList.map(async (agent) => {
          const ws = agent.workspace ?? config.agents?.defaults?.workspace
          if (!ws) return []
          return scanSkillsDir(join(ws, 'skills'), 'workspace', skillEntries, agent.id)
        })
        const results = await Promise.all(scans)
        allWorkspaceSkills = results.flat()
      } else if (config.agents?.defaults?.workspace) {
        // Single-container mode: scan default workspace, derive agentId from configDir
        const configDir = await getEffectiveConfigDir()
        const defaultAgentId = basename(configDir) || 'default'
        allWorkspaceSkills = await scanSkillsDir(
          join(config.agents.defaults.workspace, 'skills'), 'workspace', skillEntries, defaultAgentId
        )
      }
    }

    // Merge with precedence: workspace > shared
    // Use name+agentId as key to avoid deduplication across agents
    const merged = new Map<string, SkillInfo>()

    for (const skill of sharedSkills) {
      merged.set(skill.name, skill)
    }
    for (const skill of allWorkspaceSkills) {
      // Workspace skills keyed by agent+name to preserve per-agent entries
      const key = skill.agentId ? `${skill.agentId}/${skill.name}` : skill.name
      merged.set(key, skill)
    }

    const results = [...merged.values()]

    // Sort by group, then by name
    results.sort((a, b) => {
      const g = a.group.localeCompare(b.group)
      return g !== 0 ? g : a.name.localeCompare(b.name)
    })

    return c.json(results)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Validate skill name: alphanumeric, hyphens, underscores only
function isValidSkillName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name) && name.length <= 100
}

// POST /api/skills/create — create a custom shared skill
skills.post('/create', async (c) => {
  try {
    const body = await c.req.json<{ name: string; content: string }>()
    const { name, content } = body

    if (!name || !isValidSkillName(name)) {
      return c.json(
        { error: 'Invalid skill name. Use alphanumeric characters, hyphens, and underscores.' },
        400
      )
    }
    if (!content || !content.includes('---')) {
      return c.json({ error: 'Content must include frontmatter (--- markers).' }, 400)
    }

    const configDir = await getEffectiveConfigDir()
    const skillDir = join(configDir, 'skills', name)
    const skillMdPath = join(skillDir, 'SKILL.md')

    // Check if already exists
    try {
      await readFile(skillMdPath, 'utf-8')
      return c.json({ error: `Skill "${name}" already exists.` }, 409)
    } catch {
      // Expected — skill doesn't exist yet
    }

    await mkdir(skillDir, { recursive: true })
    await writeFile(skillMdPath, content, 'utf-8')

    const fm = parseFrontmatter(content)
    const config = await readConfig()
    const skillEntries: Record<string, unknown> = config?.skills?.entries ?? {}

    return c.json({
      name: fm.name || name,
      description: fm.description || '',
      group: fm.group || fm.category || 'general',
      hasConfig: name in skillEntries || (fm.name || name) in skillEntries,
      source: 'shared' as const,
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// POST /api/skills/import — import a full skill folder (multiple files)
skills.post('/import', async (c) => {
  try {
    const body = await c.req.json<{ name: string; files: { path: string; content: string }[] }>()
    const { name, files } = body

    if (!name || !isValidSkillName(name)) {
      return c.json(
        { error: 'Invalid skill name. Use alphanumeric characters, hyphens, and underscores.' },
        400
      )
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return c.json({ error: 'No files provided.' }, 400)
    }

    // Validate all file paths (no directory traversal)
    for (const file of files) {
      if (!file.path || file.path.includes('..') || file.path.startsWith('/')) {
        return c.json({ error: `Invalid file path: ${file.path}` }, 400)
      }
    }

    const configDir = await getEffectiveConfigDir()
    const skillDir = join(configDir, 'skills', name)

    // Check if already exists
    try {
      await readFile(join(skillDir, 'SKILL.md'), 'utf-8')
      return c.json({ error: `Skill "${name}" already exists.` }, 409)
    } catch {
      // Expected — skill doesn't exist yet
    }

    // Write all files
    for (const file of files) {
      const filePath = join(skillDir, file.path)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, file.content, 'utf-8')
    }

    // Parse SKILL.md for response
    const skillMd = files.find((f) => f.path === 'SKILL.md')
    const fm = skillMd ? parseFrontmatter(skillMd.content) : {}
    const config = await readConfig()
    const skillEntries: Record<string, unknown> = config?.skills?.entries ?? {}

    return c.json({
      name: fm.name || name,
      description: fm.description || '',
      group: fm.group || fm.category || 'general',
      hasConfig: name in skillEntries || (fm.name || name) in skillEntries,
      source: 'shared' as const,
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Create a tar.gz of a skill directory, excluding junk dirs.
// Returns the archive as a Buffer.
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'

const SKIP_DIRS_TAR = ['pip_packages', '__pycache__', 'node_modules', '.git']

function createSkillArchive(skillDir: string, skillName: string): Buffer {
  const tmpFile = join(tmpdir(), `skill-publish-${skillName}-${Date.now()}.tar.gz`)
  const excludes = SKIP_DIRS_TAR.flatMap(d => ['--exclude', d])
  try {
    execFileSync('tar', [
      'czf', tmpFile,
      ...excludes,
      '-C', dirname(skillDir),
      basename(skillDir),
    ], { timeout: 30_000 })
    const buf = require('fs').readFileSync(tmpFile)
    return buf
  } finally {
    try { require('fs').unlinkSync(tmpFile) } catch {}
  }
}

// POST /api/skills/:skillName/publish — publish to Skills Hub
skills.post('/:skillName/publish', async (c) => {
  const skillName = c.req.param('skillName')
  if (!skillName || !isValidSkillName(skillName)) {
    return c.json({ error: 'Invalid skill name.' }, 400)
  }

  const body = await c.req.json<{ source?: string; agentId?: string }>().catch(() => ({}))
  const config = await readConfig()

  // Resolve skill directory based on source
  let skillDir: string
  if (body.source === 'workspace' && body.agentId) {
    const ws = getAgentWorkspace(config, body.agentId)
    if (!ws) {
      return c.json({ error: `Agent "${body.agentId}" workspace not found.` }, 404)
    }
    skillDir = join(ws, 'skills', skillName)
  } else {
    const configDir = await getEffectiveConfigDir()
    skillDir = join(configDir, 'skills', skillName)
  }

  // Verify SKILL.md exists
  let content: string
  try {
    content = await readFile(join(skillDir, 'SKILL.md'), 'utf-8')
  } catch {
    return c.json({ error: `Skill "${skillName}" not found locally.` }, 404)
  }

  const hubUrl = process.env.SKILLS_HUB_URL
  if (!hubUrl) {
    return c.json({ error: 'Skills Hub not configured (SKILLS_HUB_URL env not set).' }, 400)
  }
  const token = (config as any)?.gateway?.auth?.token
  if (!token) {
    return c.json({ error: 'Gateway token not found.' }, 500)
  }

  // Create tar.gz archive of the skill directory
  let archive: Buffer
  try {
    archive = createSkillArchive(skillDir, skillName)
  } catch (err: any) {
    return c.json({ error: `Failed to create archive: ${err.message}` }, 500)
  }

  // Upload as multipart/form-data
  const formData = new FormData()
  formData.append('name', skillName)
  formData.append('content', content)
  formData.append('archive', new Blob([archive], { type: 'application/gzip' }), `${skillName}.tar.gz`)

  let resp: Response
  try {
    resp = await fetch(`${hubUrl}/api/skills/publish/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })
  } catch (err: any) {
    return c.json({ error: `Failed to connect to Skills Hub: ${err.message}` }, 502)
  }

  const result: any = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const code = resp.status >= 400 && resp.status < 600 ? resp.status : 502
    return c.json({ error: result.error || `Hub responded with ${resp.status}` }, code as any)
  }
  return c.json(result)
})

// GET /api/skills/:skillName/content — get raw SKILL.md content for editing
skills.get('/:skillName/content', async (c) => {
  try {
    const skillName = c.req.param('skillName')
    const configDir = await getEffectiveConfigDir()
    const skillMdPath = join(configDir, 'skills', skillName, 'SKILL.md')

    let content: string
    try {
      content = await readFile(skillMdPath, 'utf-8')
    } catch {
      return c.json({ error: `Skill "${skillName}" not found.` }, 404)
    }

    return c.json({ name: skillName, content })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// PUT /api/skills/:skillName — update an existing shared skill
skills.put('/:skillName', async (c) => {
  try {
    const skillName = c.req.param('skillName')
    const body = await c.req.json<{ content: string }>()
    const { content } = body

    if (!content) {
      return c.json({ error: 'Missing "content" in request body.' }, 400)
    }

    const configDir = await getEffectiveConfigDir()
    const skillMdPath = join(configDir, 'skills', skillName, 'SKILL.md')

    // Verify skill exists
    try {
      await readFile(skillMdPath, 'utf-8')
    } catch {
      return c.json({ error: `Skill "${skillName}" not found.` }, 404)
    }

    await writeFile(skillMdPath, content, 'utf-8')

    const fm = parseFrontmatter(content)
    const config = await readConfig()
    const skillEntries: Record<string, unknown> = config?.skills?.entries ?? {}

    return c.json({
      name: fm.name || skillName,
      description: fm.description || '',
      group: fm.group || fm.category || 'general',
      hasConfig: skillName in skillEntries || (fm.name || skillName) in skillEntries,
      source: 'shared' as const,
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE /api/skills/:skillName — delete a shared skill
skills.delete('/:skillName', async (c) => {
  try {
    const skillName = c.req.param('skillName')
    if (!skillName || !isValidSkillName(skillName)) {
      return c.json({ error: 'Invalid skill name.' }, 400)
    }

    const configDir = await getEffectiveConfigDir()
    const skillDir = join(configDir, 'skills', skillName)
    const skillMdPath = join(skillDir, 'SKILL.md')

    // Verify skill exists
    try {
      await readFile(skillMdPath, 'utf-8')
    } catch {
      return c.json({ error: `Skill "${skillName}" not found.` }, 404)
    }

    await rm(skillDir, { recursive: true, force: true })
    return c.json({ deleted: true, name: skillName })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default skills
