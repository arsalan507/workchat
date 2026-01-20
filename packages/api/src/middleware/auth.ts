import { FastifyReply, FastifyRequest } from 'fastify'
import { Server as SocketServer } from 'socket.io'
import { ChatMemberRole, GroupPermission, hasGroupPermission } from '@workchat/shared'
import { ForbiddenError, UnauthorizedError } from './errorHandler'
import { prisma } from '@workchat/database'

// Define user payload type (no role in JWT anymore)
export interface JWTPayload {
  id: string
  phone?: string
  name?: string
  type?: 'refresh'
}

// User type is the verified user object from access tokens
export interface JWTUser {
  id: string
  phone: string
  name: string
}

// Extend @fastify/jwt to define our user type
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTUser
  }
}

// Extend Fastify to add socket.io
declare module 'fastify' {
  interface FastifyInstance {
    io: SocketServer
  }
}

/**
 * Middleware to verify JWT and attach user to request
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<{
      id: string
      phone: string
      name: string
    }>()
    request.user = decoded
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token')
  }
}

/**
 * Get a user's role in a specific chat
 */
export async function getChatMemberRole(
  userId: string,
  chatId: string
): Promise<ChatMemberRole | null> {
  const member = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId,
      },
    },
  })
  return member?.role as ChatMemberRole | null
}

/**
 * Middleware to check if user is a member of the chat
 * Attaches memberRole to request for use in subsequent handlers
 */
export function requireChatMember(chatIdParam: string = 'chatId') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required')
    }

    const chatId = (request.params as Record<string, string>)[chatIdParam]
    if (!chatId) {
      throw new ForbiddenError('Chat ID is required')
    }

    const memberRole = await getChatMemberRole(request.user.id, chatId)
    if (!memberRole) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Attach memberRole to request for use in handlers
    ;(request as any).memberRole = memberRole
  }
}

/**
 * Middleware factory to check if user has required group permission
 * Must be used after requireChatMember
 */
export function requireGroupPermission(permission: GroupPermission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const memberRole = (request as any).memberRole as ChatMemberRole | undefined

    if (!memberRole) {
      throw new ForbiddenError('Chat membership not verified')
    }

    if (!hasGroupPermission(memberRole, permission)) {
      throw new ForbiddenError(`You do not have permission to ${permission.replace(/_/g, ' ')}`)
    }
  }
}

/**
 * Middleware to check if user is group admin (OWNER or ADMIN)
 * Must be used after requireChatMember
 */
export async function requireGroupAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const memberRole = (request as any).memberRole as ChatMemberRole | undefined

  if (!memberRole) {
    throw new ForbiddenError('Chat membership not verified')
  }

  if (memberRole !== ChatMemberRole.OWNER && memberRole !== ChatMemberRole.ADMIN) {
    throw new ForbiddenError('Group admin access required')
  }
}

/**
 * Middleware to check if user is group owner
 * Must be used after requireChatMember
 */
export async function requireGroupOwner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const memberRole = (request as any).memberRole as ChatMemberRole | undefined

  if (!memberRole) {
    throw new ForbiddenError('Chat membership not verified')
  }

  if (memberRole !== ChatMemberRole.OWNER) {
    throw new ForbiddenError('Group owner access required')
  }
}
