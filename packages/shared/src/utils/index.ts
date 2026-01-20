import { TaskStatus, Task, UserRole, Permission } from '../types'
import { ALLOWED_TRANSITIONS, PERMISSIONS } from '../constants'

// ============================================
// TASK STATUS UTILITIES
// ============================================

/**
 * Check if a task status transition is allowed
 */
export function canTransitionTo(
  currentStatus: TaskStatus,
  newStatus: TaskStatus
): boolean {
  const allowedStatuses = ALLOWED_TRANSITIONS[currentStatus]
  return allowedStatuses.includes(newStatus)
}

/**
 * Check if a task is overdue based on due date
 */
export function isOverdue(dueDate: Date | string | null): boolean {
  if (!dueDate) return false
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  return due < new Date()
}

/**
 * Get the display status for a task (returns OVERDUE if past due and not completed)
 */
export function getTaskDisplayStatus(task: Task): TaskStatus | 'OVERDUE' {
  if (
    task.status !== TaskStatus.APPROVED &&
    task.status !== TaskStatus.COMPLETED &&
    isOverdue(task.dueDate)
  ) {
    return 'OVERDUE'
  }
  return task.status
}

/**
 * Check if all mandatory steps are completed
 */
export function areAllMandatoryStepsCompleted(task: Task): boolean {
  return task.steps
    .filter((step) => step.isMandatory)
    .every((step) => step.completedAt !== null)
}

/**
 * Check if task can be marked as completed
 */
export function canCompleteTask(task: Task): boolean {
  if (task.status !== TaskStatus.IN_PROGRESS) return false
  return areAllMandatoryStepsCompleted(task)
}

// ============================================
// PERMISSION UTILITIES
// ============================================

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission)
}

/**
 * Check if user can create another user with given role
 */
export function canCreateUserWithRole(
  creatorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (creatorRole === UserRole.SUPER_ADMIN) return true
  if (creatorRole === UserRole.ADMIN && targetRole === UserRole.STAFF) return true
  return false
}

/**
 * Check if user is admin or super admin
 */
export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN
}

// ============================================
// DATE/TIME FORMATTING UTILITIES
// ============================================

/**
 * Format a date/time for message display (HH:MM)
 */
export function formatMessageTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Format a date for chat list display (Today, Yesterday, or date)
 */
export function formatMessageDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (messageDate.getTime() === today.getTime()) {
    return 'Today'
  }
  if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }

  // Check if same week
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  if (messageDate > weekAgo) {
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Return full date
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/**
 * Format date for task due date display
 */
export function formatDueDate(date: Date | string | null): string {
  if (!date) return 'No due date'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`
  }
  if (diffDays === 0) {
    return 'Due today'
  }
  if (diffDays === 1) {
    return 'Due tomorrow'
  }
  if (diffDays <= 7) {
    return `Due in ${diffDays} days`
  }

  return `Due ${d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })}`
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Get initials from a name for avatar display
 */
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '')

  // Format based on length (assuming Indian format for now)
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  return phone
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6
}

// ============================================
// FILE UTILITIES
// ============================================

/**
 * Get file extension from URL or filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Generate a unique filename for uploads
 */
export function generateUploadFilename(originalName: string): string {
  const ext = getFileExtension(originalName)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}_${random}${ext ? '.' + ext : ''}`
}
