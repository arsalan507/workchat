import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { OTP_EXPIRY_MINUTES } from '@workchat/shared'
import { authenticate } from '../middleware/auth'
import { AppError, UnauthorizedError } from '../middleware/errorHandler'
import crypto from 'crypto'

// Twilio Verify Service configuration
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || 'VAe554aec66d9657b6f8949312fc250e96'

// Twilio client (lazy initialization)
let twilioClient: any = null

function getTwilioClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    // Dynamic import to avoid errors if Twilio isn't installed
    const twilio = require('twilio')
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return twilioClient
}

// Validation schemas
const requestOtpSchema = z.object({
  phone: z.string().min(10).max(15),
})

const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
  name: z.string().min(1).max(100).optional(), // Required for new users
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

// Refresh token expiry: 90 days for WhatsApp-like persistent login
const REFRESH_TOKEN_EXPIRY_DAYS = 90

// TEST MODE: Set to true to skip Twilio and use PIN 123456
const TEST_MODE = true

// Generate a secure random token
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

// Calculate expiry date
function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/request-otp - Request OTP for phone number
   */
  fastify.post('/request-otp', async (request, reply) => {
    const body = requestOtpSchema.parse(request.body)
    const phone = body.phone.startsWith('+') ? body.phone : `+${body.phone}`

    // TEST MODE: Skip Twilio, just accept any phone
    if (TEST_MODE) {
      fastify.log.info(`TEST MODE - Use PIN 123456 for ${phone}`)
      return {
        success: true,
        data: {
          message: 'Use PIN: 123456',
          expiresIn: OTP_EXPIRY_MINUTES * 60,
          testMode: true,
        },
      }
    }

    // Production: Send OTP via Twilio Verify Service
    const client = getTwilioClient()
    if (client && TWILIO_VERIFY_SERVICE_SID) {
      try {
        const verification = await client.verify.v2
          .services(TWILIO_VERIFY_SERVICE_SID)
          .verifications.create({
            to: phone,
            channel: 'sms',
          })

        fastify.log.info(`Twilio Verify sent to ${phone}, status: ${verification.status}`)

        return {
          success: true,
          data: {
            message: 'OTP sent successfully',
            expiresIn: OTP_EXPIRY_MINUTES * 60,
          },
        }
      } catch (error: any) {
        fastify.log.error(`Failed to send OTP via Twilio Verify: ${error.message}`)
        throw new AppError('Failed to send verification code. Please try again.', 500, 'OTP_SEND_FAILED')
      }
    } else {
      throw new AppError('SMS service not configured', 500, 'SMS_NOT_CONFIGURED')
    }
  })

  /**
   * POST /api/auth/verify-otp - Verify OTP and login/register
   */
  fastify.post('/verify-otp', async (request, reply) => {
    const body = verifyOtpSchema.parse(request.body)
    const phone = body.phone.startsWith('+') ? body.phone : `+${body.phone}`

    // TEST MODE: Accept PIN 123456
    if (TEST_MODE) {
      if (body.otp !== '123456') {
        throw new UnauthorizedError('Invalid PIN. Use 123456')
      }
      fastify.log.info(`TEST MODE - PIN verified for ${phone}`)
    } else {
      // Production: Verify OTP via Twilio Verify Service
      const client = getTwilioClient()

      if (client && TWILIO_VERIFY_SERVICE_SID) {
        try {
          const verificationCheck = await client.verify.v2
            .services(TWILIO_VERIFY_SERVICE_SID)
            .verificationChecks.create({
              to: phone,
              code: body.otp,
            })

          if (verificationCheck.status !== 'approved') {
            throw new UnauthorizedError('Invalid or expired verification code')
          }
          fastify.log.info(`Twilio Verify approved for ${phone}`)
        } catch (error: any) {
          if (error instanceof UnauthorizedError) {
            throw error
          }
          fastify.log.error(`Twilio Verify check failed: ${error.message}`)
          throw new UnauthorizedError('Verification failed. Please try again.')
        }
      } else {
        throw new AppError('SMS service not configured', 500, 'SMS_NOT_CONFIGURED')
      }
    }

    // Find or create user by phone (use normalized phone with + prefix)
    let user = await prisma.user.findUnique({
      where: { phone },
    })

    const isNewUser = !user || !user.isVerified || !user.name

    // For new users, require name
    if (isNewUser && !body.name) {
      throw new AppError('Name is required for new users', 400, 'VALIDATION_ERROR')
    }

    // Create or update user (use normalized phone with + prefix)
    const updatedUser = await prisma.user.upsert({
      where: { phone },
      update: {
        isVerified: true,
        ...(isNewUser && body.name ? { name: body.name } : {}),
      },
      create: {
        phone,
        name: body.name || '',
        isVerified: true,
      },
    })

    // Generate access token (short-lived: 15 minutes)
    const accessToken = fastify.jwt.sign({
      id: updatedUser.id,
      phone: updatedUser.phone,
      name: updatedUser.name,
    })

    // Generate and store refresh token in database (long-lived: 90 days)
    const refreshToken = generateRefreshToken()
    const expiresAt = getRefreshTokenExpiry()

    // Get device info from user agent
    const deviceInfo = request.headers['user-agent'] || 'Unknown device'

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: updatedUser.id,
        deviceInfo,
        expiresAt,
      },
    })

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60, // 90 days in seconds
    })

    return {
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          phone: updatedUser.phone,
          name: updatedUser.name,
          avatarUrl: updatedUser.avatarUrl,
          isVerified: updatedUser.isVerified,
          createdAt: updatedUser.createdAt,
        },
        accessToken,
        refreshToken,
        isNewUser,
      },
    }
  })

  /**
   * POST /api/auth/refresh - Refresh access token
   */
  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body)
    const { refreshToken } = body

    // Find refresh token in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    })

    // Check if token exists and is not expired
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      // Delete expired token if exists
      if (tokenRecord) {
        await prisma.refreshToken.delete({ where: { id: tokenRecord.id } })
      }
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    const user = tokenRecord.user

    // Generate new access token
    const newAccessToken = fastify.jwt.sign({
      id: user.id,
      phone: user.phone,
      name: user.name,
    })

    // Generate new refresh token (token rotation for security)
    const newRefreshToken = generateRefreshToken()
    const newExpiresAt = getRefreshTokenExpiry()

    // Update refresh token in database (rotate token)
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        token: newRefreshToken,
        expiresAt: newExpiresAt,
        lastUsedAt: new Date(),
      },
    })

    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
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
    // Try to get refresh token from cookie or body
    const refreshToken = request.cookies.refreshToken || (request.body as any)?.refreshToken

    if (refreshToken) {
      // Delete the refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      })
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
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    }
  })

  /**
   * Cleanup expired tokens (can be called periodically)
   */
  const cleanupExpiredTokens = async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })
  }

  // Run cleanup on server start and every 24 hours
  cleanupExpiredTokens().catch((err) => fastify.log.error('Failed to cleanup tokens:', err))
  setInterval(() => {
    cleanupExpiredTokens().catch((err) => fastify.log.error('Failed to cleanup tokens:', err))
  }, 24 * 60 * 60 * 1000)
}
