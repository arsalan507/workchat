import { FastifyReply, FastifyRequest } from 'fastify'
import { UserRole } from '@workchat/shared'
import { ForbiddenError, UnauthorizedError } from './errorHandler'

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string
      phone: string
      name: string
      role: UserRole
    }
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
      role: UserRole
    }>()
    request.user = decoded
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token')
  }
}

/**
 * Middleware factory to check if user has required role
 */
export function authorize(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required')
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action')
    }
  }
}

/**
 * Middleware to check if user is admin or super admin
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required')
  }

  if (request.user.role !== UserRole.ADMIN && request.user.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenError('Admin access required')
  }
}

/**
 * Middleware to check if user is super admin
 */
export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required')
  }

  if (request.user.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenError('Super Admin access required')
  }
}
