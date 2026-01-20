import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/auth'
import { createWriteStream, mkdirSync, existsSync, createReadStream, statSync } from 'fs'
import { join, extname } from 'path'
import { pipeline } from 'stream/promises'
import { generateUploadFilename } from '@workchat/shared'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Simple mime type lookup
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/upload - Upload a file
   */
  fastify.post('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = await request.file()

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      })
    }

    // Generate unique filename
    const filename = generateUploadFilename(data.filename)
    const filepath = join(UPLOAD_DIR, filename)

    // Save file
    await pipeline(data.file, createWriteStream(filepath))

    // Return URL (in production, this would be a CDN or S3 URL)
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
    const fileUrl = `${baseUrl}/api/upload/${filename}`

    return {
      success: true,
      data: {
        filename,
        originalName: data.filename,
        mimetype: data.mimetype,
        url: fileUrl,
      },
    }
  })

  /**
   * GET /api/upload/:filename - Serve uploaded file (for local development)
   */
  fastify.get('/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string }

    // Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILENAME', message: 'Invalid filename' },
      })
    }

    const filepath = join(UPLOAD_DIR, filename)

    if (!existsSync(filepath)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found' },
      })
    }

    const stat = statSync(filepath)
    const mimeType = getMimeType(filename)

    reply.header('Content-Type', mimeType)
    reply.header('Content-Length', stat.size)
    reply.header('Cache-Control', 'public, max-age=31536000')

    return reply.send(createReadStream(filepath))
  })
}
