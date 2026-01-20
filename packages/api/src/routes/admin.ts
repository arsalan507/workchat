import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { TaskStatus, isOverdue } from '@workchat/shared'
import { authenticate, requireAdmin } from '../middleware/auth'

const userIdParamsSchema = z.object({
  userId: z.string(),
})

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/admin/summary - Get daily summary for admins
   */
  fastify.get('/summary', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    // Get all tasks
    const tasks = await prisma.task.findMany({
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        message: {
          select: {
            chatId: true,
          },
        },
      },
    })

    // Calculate pending tasks by user
    const pendingByUser = new Map<string, { user: any; count: number }>()
    const overdueByUser = new Map<string, { user: any; count: number }>()
    const reopenedTasks: any[] = []

    for (const task of tasks) {
      // Pending tasks
      if (task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS) {
        const existing = pendingByUser.get(task.ownerId)
        if (existing) {
          existing.count++
        } else {
          pendingByUser.set(task.ownerId, { user: task.owner, count: 1 })
        }
      }

      // Overdue tasks
      if (
        task.dueDate &&
        isOverdue(task.dueDate) &&
        task.status !== TaskStatus.APPROVED &&
        task.status !== TaskStatus.COMPLETED
      ) {
        const existing = overdueByUser.get(task.ownerId)
        if (existing) {
          existing.count++
        } else {
          overdueByUser.set(task.ownerId, { user: task.owner, count: 1 })
        }
      }

      // Reopened tasks
      if (task.status === TaskStatus.REOPENED) {
        reopenedTasks.push({
          id: task.id,
          messageId: task.messageId,
          chatId: task.message.chatId,
          title: task.title,
          owner: task.owner,
          dueDate: task.dueDate,
          createdAt: task.createdAt,
        })
      }
    }

    // Get users with no activity today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const allStaff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    })

    const usersWithActivity = await prisma.taskActivity.findMany({
      where: {
        createdAt: { gte: today },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    })

    const activeUserIds = new Set(usersWithActivity.map((a) => a.userId))
    const noActivityUsers = allStaff.filter((user) => !activeUserIds.has(user.id))

    // Get summary counts
    const totalTasks = tasks.length
    const completedToday = await prisma.task.count({
      where: {
        status: TaskStatus.COMPLETED,
        completedAt: { gte: today },
      },
    })
    const approvedToday = await prisma.task.count({
      where: {
        status: TaskStatus.APPROVED,
        approvedAt: { gte: today },
      },
    })

    return {
      success: true,
      data: {
        summary: {
          totalTasks,
          completedToday,
          approvedToday,
          pendingCount: Array.from(pendingByUser.values()).reduce((sum, v) => sum + v.count, 0),
          overdueCount: Array.from(overdueByUser.values()).reduce((sum, v) => sum + v.count, 0),
        },
        pendingByUser: Array.from(pendingByUser.values())
          .sort((a, b) => b.count - a.count),
        overdueByUser: Array.from(overdueByUser.values())
          .sort((a, b) => b.count - a.count),
        reopenedTasks,
        noActivityUsers,
      },
    }
  })

  /**
   * GET /api/admin/summary/:userId - Get summary for specific user
   */
  fastify.get('/summary/:userId', {
    preHandler: [authenticate, requireAdmin],
  }, async (request) => {
    const { userId } = userIdParamsSchema.parse(request.params)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    })

    if (!user) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      }
    }

    const tasks = await prisma.task.findMany({
      where: { ownerId: userId },
      include: {
        message: {
          select: {
            chatId: true,
            content: true,
          },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Group by status
    const tasksByStatus = {
      [TaskStatus.PENDING]: tasks.filter((t) => t.status === TaskStatus.PENDING),
      [TaskStatus.IN_PROGRESS]: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
      [TaskStatus.COMPLETED]: tasks.filter((t) => t.status === TaskStatus.COMPLETED),
      [TaskStatus.APPROVED]: tasks.filter((t) => t.status === TaskStatus.APPROVED),
      [TaskStatus.REOPENED]: tasks.filter((t) => t.status === TaskStatus.REOPENED),
    }

    const overdueTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        isOverdue(t.dueDate) &&
        t.status !== TaskStatus.APPROVED &&
        t.status !== TaskStatus.COMPLETED
    )

    // Get recent activity
    const recentActivity = await prisma.taskActivity.findMany({
      where: { userId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return {
      success: true,
      data: {
        user,
        summary: {
          total: tasks.length,
          pending: tasksByStatus[TaskStatus.PENDING].length,
          inProgress: tasksByStatus[TaskStatus.IN_PROGRESS].length,
          completed: tasksByStatus[TaskStatus.COMPLETED].length,
          approved: tasksByStatus[TaskStatus.APPROVED].length,
          reopened: tasksByStatus[TaskStatus.REOPENED].length,
          overdue: overdueTasks.length,
        },
        overdueTasks: overdueTasks.map((t) => ({
          id: t.id,
          title: t.title,
          chatId: t.message.chatId,
          dueDate: t.dueDate,
          status: t.status,
        })),
        recentActivity,
      },
    }
  })
}
