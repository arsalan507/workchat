import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { hash, compare } from 'bcrypt'
import { prisma } from '@workchat/database'
import { UserRole } from '@workchat/shared'
import { authenticate, requireAdmin } from '../middleware/auth'
import { AppError, ConflictError, UnauthorizedError } from '../middleware/errorHandler'

// Validation schemas
const loginSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(6),
})

const registerSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole).optional(),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

// Store refresh tokens (in production, use Redis)
const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>()

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/login - Login with phone and password
   */
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const user = await prisma.user.findUnique({
      where: { phone: body.phone },
    })

    if (!user) {
      throw new UnauthorizedError('Invalid phone or password')
    }

    const isValidPassword = await compare(body.password, user.password)
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid phone or password')
    }

    // Generate tokens
    const accessToken = fastify.jwt.sign({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    })

    const refreshToken = fastify.jwt.sign(
      { id: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    // Store refresh token
    refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    })

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      },
    }
  })

  /**
   * POST /api/auth/register - Register a new user (Admin only)
   */
  fastify.post('/register', {
    preHandler: [authenticate, requireAdmin],
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body)

    // Check if phone already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: body.phone },
    })

    if (existingUser) {
      throw new ConflictError('Phone number already registered')
    }

    // Check permission to create user with role
    const targetRole = body.role || UserRole.STAFF
    if (targetRole === UserRole.SUPER_ADMIN) {
      throw new AppError('Cannot create Super Admin', 403, 'FORBIDDEN')
    }
    if (targetRole === UserRole.ADMIN && request.user.role !== UserRole.SUPER_ADMIN) {
      throw new AppError('Only Super Admin can create Admin users', 403, 'FORBIDDEN')
    }

    // Hash password
    const hashedPassword = await hash(body.password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        phone: body.phone,
        password: hashedPassword,
        name: body.name,
        role: targetRole,
      },
    })

    // Generate tokens
    const accessToken = fastify.jwt.sign({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    })

    const refreshToken = fastify.jwt.sign(
      { id: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      },
    }
  })

  /**
   * POST /api/auth/refresh - Refresh access token
   */
  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body)
    const { refreshToken } = body

    // Check if refresh token exists
    const tokenData = refreshTokens.get(refreshToken)
    if (!tokenData || tokenData.expiresAt < new Date()) {
      refreshTokens.delete(refreshToken)
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
    })

    if (!user) {
      refreshTokens.delete(refreshToken)
      throw new UnauthorizedError('User not found')
    }

    // Generate new tokens
    const newAccessToken = fastify.jwt.sign({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    })

    const newRefreshToken = fastify.jwt.sign(
      { id: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    // Replace old refresh token
    refreshTokens.delete(refreshToken)
    refreshTokens.set(newRefreshToken, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60,
    })

    return {
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    }
  })

  /**
   * POST /api/auth/logout - Logout (invalidate refresh token)
   */
  fastify.post('/logout', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const refreshToken = request.cookies.refreshToken
    if (refreshToken) {
      refreshTokens.delete(refreshToken)
    }

    reply.clearCookie('refreshToken', { path: '/api/auth' })

    return {
      success: true,
      data: { message: 'Logged out successfully' },
    }
  })

  /**
   * GET /api/auth/me - Get current user
   */
  fastify.get('/me', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
    })

    if (!user) {
      throw new UnauthorizedError('User not found')
    }

    return {
      success: true,
      data: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
      },
    }
  })
}
