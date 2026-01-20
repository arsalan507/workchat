import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { ChatType } from '@workchat/shared'
import { authenticate, requireAdmin } from '../middleware/auth'
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler'

// Validation schemas
const chatIdParamsSchema = z.object({
  id: z.string(),
})

const createChatSchema = z.object({
  type: z.nativeEnum(ChatType),
  name: z.string().min(1).max(100),
  memberIds: z.array(z.string()).min(1),
})

const addMemberSchema = z.object({
  userId: z.string(),
})

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/chats - List user's chats with last message
   */
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request) => {
    const userId = request.user.id

    const chats = await prisma.chat.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Transform to include lastMessage and unreadCount
    const transformedChats = chats.map((chat) => {
      const lastMessage = chat.messages[0] || null
      return {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdBy: chat.createdBy,
        createdAt: chat.createdAt,
        members: chat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.name,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: 0, // TODO: Implement unread tracking
      }
    })

    return {
      success: true,
      data: transformedChats,
    }
  })

  /**
   * POST /api/chats - Create a new chat (Admin only)
   */
  fastify.post('/', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const body = createChatSchema.parse(request.body)
    const userId = request.user.id

    // Ensure creator is included in members
    const memberIds = [...new Set([userId, ...body.memberIds])]

    const chat = await prisma.chat.create({
      data: {
        type: body.type,
        name: body.name,
        createdBy: userId,
        members: {
          createMany: {
            data: memberIds.map((id, index) => ({
              userId: id,
              role: index === 0 ? 'OWNER' : 'MEMBER',
            })),
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    })

    return {
      success: true,
      data: {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdBy: chat.createdBy,
        createdAt: chat.createdAt,
        members: chat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    }
  })

  /**
   * GET /api/chats/:id - Get chat details
   */
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    })

    if (!chat) {
      throw new NotFoundError('Chat')
    }

    // Check if user is a member
    const isMember = chat.members.some((m) => m.userId === userId)
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    return {
      success: true,
      data: {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdBy: chat.createdBy,
        createdAt: chat.createdAt,
        members: chat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    }
  })

  /**
   * POST /api/chats/:id/members - Add member to chat (Admin only)
   */
  fastify.post('/:id/members', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)
    const body = addMemberSchema.parse(request.body)

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { members: true },
    })

    if (!chat) {
      throw new NotFoundError('Chat')
    }

    // Check if user is already a member
    if (chat.members.some((m) => m.userId === body.userId)) {
      return {
        success: true,
        data: { message: 'User is already a member' },
      }
    }

    await prisma.chatMember.create({
      data: {
        chatId: id,
        userId: body.userId,
        role: 'MEMBER',
      },
    })

    return {
      success: true,
      data: { message: 'Member added successfully' },
    }
  })

  /**
   * DELETE /api/chats/:id/members/:userId - Remove member from chat (Admin only)
   */
  fastify.delete('/:id/members/:userId', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const params = z.object({
      id: z.string(),
      userId: z.string(),
    }).parse(request.params)

    await prisma.chatMember.delete({
      where: {
        chatId_userId: {
          chatId: params.id,
          userId: params.userId,
        },
      },
    }).catch(() => {
      throw new NotFoundError('Chat member')
    })

    return {
      success: true,
      data: { message: 'Member removed successfully' },
    }
  })
}
