import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { TaskStatus, TaskPriority, UserRole, canTransitionTo, isOverdue } from '@workchat/shared'
import { authenticate, requireAdmin } from '../middleware/auth'
import { NotFoundError, ForbiddenError, ValidationError } from '../middleware/errorHandler'
import { Server as SocketServer } from 'socket.io'

// Extend Fastify to include socket.io
declare module 'fastify' {
  interface FastifyInstance {
    io: SocketServer
  }
}

// Validation schemas
const taskIdParamsSchema = z.object({
  id: z.string(),
})

const stepIdParamsSchema = z.object({
  id: z.string(),
  stepId: z.string(),
})

const taskFilterSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  ownerId: z.string().optional(),
  chatId: z.string().optional(),
  isOverdue: z.coerce.boolean().optional(),
})

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
})

const uploadProofSchema = z.object({
  stepId: z.string().optional(),
  type: z.enum(['TEXT', 'AUDIO', 'IMAGE', 'VIDEO', 'FILE']),
  url: z.string().url(),
  note: z.string().max(500).optional(),
})

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/tasks - List tasks (filtered)
   */
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request) => {
    const filters = taskFilterSchema.parse(request.query)
    const userId = request.user.id
    const isAdmin = request.user.role === UserRole.ADMIN || request.user.role === UserRole.SUPER_ADMIN

    // Build where clause
    const where: any = {}

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.chatId) {
      where.message = { chatId: filters.chatId }
    }

    // Staff can only see their own tasks
    if (!isAdmin) {
      where.ownerId = userId
    } else if (filters.ownerId) {
      where.ownerId = filters.ownerId
    }

    // Get tasks
    let tasks = await prisma.task.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            chatId: true,
            content: true,
          },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { proofs: true },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    // Filter overdue if requested
    if (filters.isOverdue) {
      tasks = tasks.filter((task) =>
        task.status !== TaskStatus.APPROVED &&
        task.status !== TaskStatus.COMPLETED &&
        isOverdue(task.dueDate)
      )
    }

    return {
      success: true,
      data: tasks.map((task) => ({
        id: task.id,
        messageId: task.messageId,
        chatId: task.message.chatId,
        title: task.title,
        ownerId: task.ownerId,
        owner: task.owner,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        isRecurring: task.isRecurring,
        recurringRule: task.recurringRule,
        approvalRequired: task.approvalRequired,
        steps: task.steps,
        proofCount: task._count.proofs,
        createdById: task.createdById,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        approvedAt: task.approvedAt,
        isOverdue: isOverdue(task.dueDate) &&
          task.status !== TaskStatus.APPROVED &&
          task.status !== TaskStatus.COMPLETED,
      })),
    }
  })

  /**
   * GET /api/tasks/:id - Get task details
   */
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            phone: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            chatId: true,
            content: true,
            type: true,
          },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
        proofs: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    return {
      success: true,
      data: {
        id: task.id,
        messageId: task.messageId,
        chatId: task.message.chatId,
        messageContent: task.message.content,
        title: task.title,
        ownerId: task.ownerId,
        owner: task.owner,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        isRecurring: task.isRecurring,
        recurringRule: task.recurringRule,
        approvalRequired: task.approvalRequired,
        steps: task.steps,
        proofs: task.proofs,
        activities: task.activities,
        createdById: task.createdById,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        approvedAt: task.approvedAt,
        isOverdue: isOverdue(task.dueDate) &&
          task.status !== TaskStatus.APPROVED &&
          task.status !== TaskStatus.COMPLETED,
      },
    }
  })

  /**
   * PATCH /api/tasks/:id/status - Update task status
   */
  fastify.patch('/:id/status', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)
    const { status: newStatus } = updateStatusSchema.parse(request.body)
    const userId = request.user.id
    const userRole = request.user.role
    const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        message: { select: { chatId: true } },
        steps: true,
      },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Check permission
    const isOwner = task.ownerId === userId

    // COMPLETED can only be set by owner
    if (newStatus === TaskStatus.COMPLETED && !isOwner) {
      throw new ForbiddenError('Only the task owner can mark it as completed')
    }

    // APPROVED and REOPENED can only be set by admin
    if ((newStatus === TaskStatus.APPROVED || newStatus === TaskStatus.REOPENED) && !isAdmin) {
      throw new ForbiddenError('Only admins can approve or reopen tasks')
    }

    // IN_PROGRESS can be set by owner or admin
    if (newStatus === TaskStatus.IN_PROGRESS && !isOwner && !isAdmin) {
      throw new ForbiddenError('You do not have permission to update this task')
    }

    // Check if transition is allowed
    if (!canTransitionTo(task.status, newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${task.status} to ${newStatus}`
      )
    }

    // If completing, check all mandatory steps
    if (newStatus === TaskStatus.COMPLETED) {
      const incompleteMandatory = task.steps.filter(
        (s) => s.isMandatory && !s.completedAt
      )
      if (incompleteMandatory.length > 0) {
        throw new ValidationError(
          `Complete all mandatory steps before marking as completed. Missing: ${incompleteMandatory.map((s) => s.content).join(', ')}`
        )
      }
    }

    // Update task
    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === TaskStatus.COMPLETED && { completedAt: new Date() }),
          ...(newStatus === TaskStatus.APPROVED && { approvedAt: new Date() }),
          ...(newStatus === TaskStatus.REOPENED && { completedAt: null }),
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          steps: { orderBy: { order: 'asc' } },
        },
      })

      // Create activity
      await tx.taskActivity.create({
        data: {
          taskId: id,
          userId,
          action: newStatus === TaskStatus.APPROVED ? 'APPROVED' :
                  newStatus === TaskStatus.REOPENED ? 'REOPENED' : 'STATUS_CHANGED',
          details: { from: task.status, to: newStatus },
        },
      })

      return updated
    })

    // Emit socket event
    fastify.io.to(`chat:${task.message.chatId}`).emit('task_status_changed', {
      chatId: task.message.chatId,
      task: {
        id: updatedTask.id,
        messageId: updatedTask.messageId,
        status: updatedTask.status,
        completedAt: updatedTask.completedAt,
        approvedAt: updatedTask.approvedAt,
      },
    })

    return {
      success: true,
      data: updatedTask,
    }
  })

  /**
   * POST /api/tasks/:id/steps/:stepId/complete - Mark step as completed
   */
  fastify.post('/:id/steps/:stepId/complete', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id, stepId } = stepIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Only owner can complete steps
    if (task.ownerId !== userId) {
      throw new ForbiddenError('Only the task owner can complete steps')
    }

    const step = await prisma.taskStep.update({
      where: { id: stepId },
      data: {
        completedAt: new Date(),
        completedById: userId,
      },
    })

    // Create activity
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId,
        action: 'STEP_COMPLETED',
        details: { stepId, stepContent: step.content },
      },
    })

    return {
      success: true,
      data: step,
    }
  })

  /**
   * POST /api/tasks/:id/proof - Upload proof for task
   */
  fastify.post('/:id/proof', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)
    const body = uploadProofSchema.parse(request.body)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
      include: { message: { select: { chatId: true } } },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Create proof
    const proof = await prisma.taskProof.create({
      data: {
        taskId: id,
        stepId: body.stepId || null,
        userId,
        type: body.type as any,
        url: body.url,
        note: body.note || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create activity
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId,
        action: 'PROOF_UPLOADED',
        details: { proofId: proof.id, stepId: body.stepId },
      },
    })

    return {
      success: true,
      data: proof,
    }
  })

  /**
   * POST /api/tasks/:id/approve - Approve a completed task (Admin only)
   */
  fastify.post('/:id/approve', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)

    // Use the status update logic
    request.body = { status: TaskStatus.APPROVED }
    return fastify.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}/status`,
      headers: request.headers,
      payload: { status: TaskStatus.APPROVED },
    })
  })

  /**
   * POST /api/tasks/:id/reopen - Reopen a task (Admin only)
   */
  fastify.post('/:id/reopen', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)

    request.body = { status: TaskStatus.REOPENED }
    return fastify.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}/status`,
      headers: request.headers,
      payload: { status: TaskStatus.REOPENED },
    })
  })
}
