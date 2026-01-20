import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { MessageType, TaskPriority, TaskStatus, canTransitionTo } from '@workchat/shared'
import { authenticate, requireAdmin } from '../middleware/auth'
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../middleware/errorHandler'
import { Server as SocketServer } from 'socket.io'

// Extend Fastify to include socket.io
declare module 'fastify' {
  interface FastifyInstance {
    io: SocketServer
  }
}

// Validation schemas
const chatIdParamsSchema = z.object({
  id: z.string(),
})

const messageIdParamsSchema = z.object({
  id: z.string(),
})

const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

const sendMessageSchema = z.object({
  content: z.string().max(5000).optional(),
  type: z.nativeEnum(MessageType).default(MessageType.TEXT),
  fileUrl: z.string().url().optional(),
  replyToId: z.string().optional(),
}).refine(
  (data) => data.content || data.fileUrl,
  { message: 'Either content or fileUrl is required' }
)

const convertToTaskSchema = z.object({
  title: z.string().max(200).optional(),
  ownerId: z.string(),
  dueDate: z.string().datetime().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  steps: z.array(z.object({
    content: z.string(),
    isMandatory: z.boolean().default(true),
    proofRequired: z.boolean().default(false),
  })).optional(),
  approvalRequired: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  recurringRule: z.string().optional(),
})

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/chats/:id/messages - Get messages for a chat (paginated)
   */
  fastify.get('/chats/:id/messages', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: chatId } = chatIdParamsSchema.parse(request.params)
    const { cursor, limit } = paginationSchema.parse(request.query)
    const userId = request.user.id

    // Check if user is a member
    const membership = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    })

    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Build query
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        sender: {
          select: {
            id: true,
            phone: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            senderId: true,
            sender: {
              select: { name: true },
            },
          },
        },
        task: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Take one extra to check for more
    })

    const hasMore = messages.length > limit
    const data = hasMore ? messages.slice(0, -1) : messages

    return {
      success: true,
      data: data.map((msg) => ({
        id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        sender: msg.sender,
        content: msg.content,
        type: msg.type,
        fileUrl: msg.fileUrl,
        replyToId: msg.replyToId,
        replyTo: msg.replyTo,
        isTask: msg.isTask,
        task: msg.task,
        createdAt: msg.createdAt,
      })),
      meta: {
        cursor: data.length > 0 ? data[data.length - 1].createdAt.toISOString() : null,
        hasMore,
      },
    }
  })

  /**
   * POST /api/chats/:id/messages - Send a message to a chat
   */
  fastify.post('/chats/:id/messages', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: chatId } = chatIdParamsSchema.parse(request.params)
    const body = sendMessageSchema.parse(request.body)
    const userId = request.user.id

    // Check if user is a member
    const membership = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    })

    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: body.content || null,
        type: body.type,
        fileUrl: body.fileUrl || null,
        replyToId: body.replyToId || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            phone: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            senderId: true,
            sender: {
              select: { name: true },
            },
          },
        },
      },
    })

    // Update chat's updatedAt
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    // Emit socket event
    fastify.io.to(`chat:${chatId}`).emit('new_message', {
      chatId,
      message: {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        sender: message.sender,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        replyToId: message.replyToId,
        replyTo: message.replyTo,
        isTask: message.isTask,
        task: null,
        createdAt: message.createdAt,
      },
    })

    return {
      success: true,
      data: {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        sender: message.sender,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        replyToId: message.replyToId,
        replyTo: message.replyTo,
        isTask: message.isTask,
        task: null,
        createdAt: message.createdAt,
      },
    }
  })

  /**
   * POST /api/messages/:id/convert-to-task - Convert a message to a task (Admin only)
   */
  fastify.post('/:id/convert-to-task', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const { id: messageId } = messageIdParamsSchema.parse(request.params)
    const body = convertToTaskSchema.parse(request.body)
    const userId = request.user.id

    // Get message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!message) {
      throw new NotFoundError('Message')
    }

    // Check if already a task
    if (message.isTask) {
      throw new ConflictError('Message is already a task')
    }

    // Check if owner is a chat member
    const isOwnerMember = message.chat.members.some((m) => m.userId === body.ownerId)
    if (!isOwnerMember) {
      throw new ValidationError('Owner must be a member of this chat')
    }

    // Create task
    const title = body.title || message.content?.slice(0, 200) || 'Untitled Task'

    const result = await prisma.$transaction(async (tx) => {
      // Update message
      const updatedMessage = await tx.message.update({
        where: { id: messageId },
        data: { isTask: true },
      })

      // Create task
      const task = await tx.task.create({
        data: {
          messageId,
          title,
          ownerId: body.ownerId,
          priority: body.priority,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          approvalRequired: body.approvalRequired,
          isRecurring: body.isRecurring,
          recurringRule: body.recurringRule || null,
          createdById: userId,
          steps: body.steps ? {
            createMany: {
              data: body.steps.map((step, index) => ({
                order: index + 1,
                content: step.content,
                isMandatory: step.isMandatory,
                proofRequired: step.proofRequired,
              })),
            },
          } : undefined,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      })

      // Create activity
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          userId,
          action: 'CREATED',
          details: { title: task.title },
        },
      })

      return { message: updatedMessage, task }
    })

    // Emit socket event
    fastify.io.to(`chat:${message.chatId}`).emit('message_converted_to_task', {
      chatId: message.chatId,
      messageId,
      task: result.task,
    })

    return {
      success: true,
      data: {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        replyToId: message.replyToId,
        isTask: true,
        task: result.task,
        createdAt: message.createdAt,
      },
    }
  })
}
