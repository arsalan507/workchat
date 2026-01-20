import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'

import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { chatRoutes } from './routes/chats'
import { messageRoutes } from './routes/messages'
import { taskRoutes } from './routes/tasks'
import { uploadRoutes } from './routes/upload'
import { setupSocketHandlers } from './socket'
import { errorHandler } from './middleware/errorHandler'

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for development
  })

  await fastify.register(cookie)

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
  })

  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max
    },
  })

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // Global error handler
  fastify.setErrorHandler(errorHandler)

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(userRoutes, { prefix: '/api/users' })
  await fastify.register(chatRoutes, { prefix: '/api/chats' })
  await fastify.register(messageRoutes, { prefix: '/api' })  // Routes already have /chats/:id/messages paths
  await fastify.register(taskRoutes, { prefix: '/api/tasks' })
  await fastify.register(uploadRoutes, { prefix: '/api/upload' })

  return fastify
}

async function start() {
  const fastify = await buildServer()

  // Create HTTP server for Socket.io
  const httpServer = createServer(fastify.server)

  // Setup Socket.io
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  })

  // Attach io to fastify for use in routes
  fastify.decorate('io', io)

  // Setup socket handlers
  setupSocketHandlers(io, fastify)

  try {
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`
╔════════════════════════════════════════════╗
║         WorkChat API Server                ║
╠════════════════════════════════════════════╣
║  🚀 Server running on http://${HOST}:${PORT}    ║
║  📡 WebSocket ready                        ║
║  🌍 Environment: ${process.env.NODE_ENV || 'development'}           ║
╚════════════════════════════════════════════╝
    `)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...')
  process.exit(0)
})
