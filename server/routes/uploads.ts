import { Hono } from 'hono'
import { readdir, stat, unlink, mkdir } from 'fs/promises'
import { createWriteStream } from 'fs'
import { join, basename, extname } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { readConfig } from '../lib/config.js'
import { fileExists } from './workspace.js'

const uploads = new Hono()

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.zip': 'application/zip',
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_MAP[ext] || 'application/octet-stream'
}

/** Validate filename: no path traversal, no hidden files */
function isValidFilename(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false
  if (name.startsWith('.')) return false
  if (name !== basename(name)) return false
  return true
}

async function getUploadsDir(): Promise<string> {
  const config = await readConfig()
  const ws = config?.agents?.defaults?.workspace
  if (!ws) throw new Error('No workspace path configured in agents.defaults.workspace')
  const uploadsDir = join(ws, 'uploads')
  await mkdir(uploadsDir, { recursive: true })
  return uploadsDir
}

// GET /api/uploads — list uploaded files
uploads.get('/', async (c) => {
  try {
    const uploadsDir = await getUploadsDir()
    const entries = await readdir(uploadsDir)
    const files = await Promise.all(
      entries
        .filter((name) => !name.startsWith('.'))
        .map(async (name) => {
          const filePath = join(uploadsDir, name)
          const s = await stat(filePath)
          if (!s.isFile()) return null
          return {
            name,
            size: s.size,
            mimeType: getMimeType(name),
            uploadedAt: s.mtime.toISOString(),
          }
        })
    )
    return c.json(files.filter(Boolean))
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// POST /api/uploads — upload file (multipart/form-data)
uploads.post('/', async (c) => {
  try {
    const contentLength = parseInt(c.req.header('content-length') || '0', 10)
    if (contentLength > MAX_FILE_SIZE) {
      return c.json({ error: `File too large. Maximum size is 100MB.` }, 413)
    }

    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided. Use "file" field in multipart form data.' }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 100MB.` }, 413)
    }

    const filename = file.name
    if (!isValidFilename(filename)) {
      return c.json({ error: `Invalid filename: ${filename}` }, 400)
    }

    const uploadsDir = await getUploadsDir()
    const filePath = join(uploadsDir, filename)

    const overwrite = c.req.query('overwrite') === 'true'
    if (!overwrite && await fileExists(filePath)) {
      return c.json({ error: `File already exists: ${filename}. Use ?overwrite=true to replace.` }, 409)
    }

    // Stream file to disk
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const writeStream = createWriteStream(filePath)
    const readable = Readable.from(buffer)
    await pipeline(readable, writeStream)

    const s = await stat(filePath)
    return c.json({
      name: filename,
      size: s.size,
      mimeType: getMimeType(filename),
      uploadedAt: s.mtime.toISOString(),
    }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// GET /api/uploads/:filename — download file
uploads.get('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename')
    if (!isValidFilename(filename)) {
      return c.json({ error: `Invalid filename: ${filename}` }, 400)
    }

    const uploadsDir = await getUploadsDir()
    const filePath = join(uploadsDir, filename)

    if (!(await fileExists(filePath))) {
      return c.json({ error: `File not found: ${filename}` }, 404)
    }

    const { readFile } = await import('fs/promises')
    const data = await readFile(filePath)
    const mimeType = getMimeType(filename)

    return new Response(data, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': data.byteLength.toString(),
      },
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE /api/uploads/:filename — delete file
uploads.delete('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename')
    if (!isValidFilename(filename)) {
      return c.json({ error: `Invalid filename: ${filename}` }, 400)
    }

    const uploadsDir = await getUploadsDir()
    const filePath = join(uploadsDir, filename)

    if (!(await fileExists(filePath))) {
      return c.json({ error: `File not found: ${filename}` }, 404)
    }

    await unlink(filePath)
    return c.json({ deleted: true, name: filename })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default uploads
