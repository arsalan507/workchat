import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { authenticate, requireAdmin } from '../middleware/auth'
import { NotFoundError } from '../middleware/errorHandler'

// Validation schemas
const userIdParamsSchema = z.object({
  id: z.string(),
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
})

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/users - List all users (Admin only)
   */
  fastify.get('/', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      data: users,
    }
  })

  /**
   * GET /api/users/:id - Get user details
   */
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = userIdParamsSchema.parse(request.params)

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    return {
      success: true,
      data: user,
    }
  })

  /**
   * PATCH /api/users/:id - Update user (self or admin)
   */
  fastify.patch('/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = userIdParamsSchema.parse(request.params)
    const body = updateUserSchema.parse(request.body)

    // Check permission: user can update self, admin can update anyone
    const isAdmin = request.user.role === 'ADMIN' || request.user.role === 'SUPER_ADMIN'
    if (!isAdmin && request.user.id !== id) {
      throw new NotFoundError('User')
    }

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    })

    return {
      success: true,
      data: user,
    }
  })
}
