import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { TaskStatus, TaskPriority, TASK_STATUS_COLORS, ChatMemberRole, formatMessageTime } from '@workchat/shared'

interface TaskDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  chatId: string
  memberRole?: string
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
)

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
  </svg>
)

const UserIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
)

export default function TaskDetailsModal({
  isOpen,
  onClose,
  taskId,
  chatId,
  memberRole,
}: TaskDetailsModalProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')

  const isGroupAdmin = memberRole === ChatMemberRole.OWNER || memberRole === ChatMemberRole.ADMIN

  // Fetch task details
  const { data: taskData, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const response = await api.get(`/api/tasks/${taskId}`)
      return response.data.data
    },
    enabled: isOpen && !!taskId,
  })

  const task = taskData

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: TaskStatus) => {
      const response = await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })

  // Complete step mutation
  const completeStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const response = await api.post(`/api/tasks/${taskId}/steps/${stepId}/complete`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    },
  })

  // Approve task mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/tasks/${taskId}/approve`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })

  // Reopen task mutation
  const reopenMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/tasks/${taskId}/reopen`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })

  const isTaskOwner = task?.ownerId === user?.id
  const canComplete = isTaskOwner && task?.status !== TaskStatus.APPROVED && task?.status !== TaskStatus.COMPLETED
  const canApprove = isGroupAdmin && task?.status === TaskStatus.COMPLETED
  const canReopen = isGroupAdmin && task?.status === TaskStatus.COMPLETED

  const getStatusColor = (status: TaskStatus) => {
    return TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS.PENDING
  }

  const priorityColors: Record<string, string> = {
    LOW: '#8696A0',
    MEDIUM: '#00A884',
    HIGH: '#F59E0B',
    URGENT: '#EF4444',
  }

  const formatDueDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'CREATED':
        return '+'
      case 'STATUS_CHANGED':
        return '→'
      case 'STEP_COMPLETED':
        return '✓'
      case 'PROOF_UPLOADED':
        return '📎'
      case 'APPROVED':
        return '✅'
      case 'REOPENED':
        return '↩'
      default:
        return '•'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#111B21] rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#202C33] px-4 py-4 flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-[#AEBAC1] hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
          <h2 className="text-[#E9EDEF] text-lg font-medium flex-1">Task Details</h2>
          {task && (
            <span
              className="px-2 py-1 rounded text-xs font-medium text-white"
              style={{ backgroundColor: getStatusColor(task.status) }}
            >
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-[#00A884] border-t-transparent rounded-full" />
          </div>
        ) : task ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-[#3B4A54]">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'details'
                    ? 'text-[#00A884] border-b-2 border-[#00A884]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'activity'
                    ? 'text-[#00A884] border-b-2 border-[#00A884]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                Activity ({task.activities?.length || 0})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'details' ? (
                <>
                  {/* Title */}
                  <div>
                    <h3 className="text-lg font-medium text-[#E9EDEF]">{task.title}</h3>
                    {task.messageContent && (
                      <p className="text-sm text-[#8696A0] mt-1">{task.messageContent}</p>
                    )}
                  </div>

                  {/* Meta info */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Owner */}
                    <div className="bg-[#202C33] rounded-lg p-3">
                      <div className="flex items-center gap-2 text-[#8696A0] text-xs mb-1">
                        <UserIcon />
                        <span>Assigned to</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#6B7C85] flex items-center justify-center text-white text-xs font-medium">
                          {task.owner?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-sm text-[#E9EDEF]">{task.owner?.name}</span>
                      </div>
                    </div>

                    {/* Priority */}
                    <div className="bg-[#202C33] rounded-lg p-3">
                      <p className="text-xs text-[#8696A0] mb-1">Priority</p>
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${priorityColors[task.priority]}20`,
                          color: priorityColors[task.priority],
                        }}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {/* Due date */}
                    {task.dueDate && (
                      <div className="bg-[#202C33] rounded-lg p-3">
                        <div className="flex items-center gap-2 text-[#8696A0] text-xs mb-1">
                          <ClockIcon />
                          <span>Due date</span>
                        </div>
                        <p className={`text-sm ${task.isOverdue ? 'text-[#EF4444]' : 'text-[#E9EDEF]'}`}>
                          {formatDueDate(task.dueDate)}
                        </p>
                      </div>
                    )}

                    {/* Created by */}
                    <div className="bg-[#202C33] rounded-lg p-3">
                      <p className="text-xs text-[#8696A0] mb-1">Created by</p>
                      <p className="text-sm text-[#E9EDEF]">{task.createdBy?.name}</p>
                    </div>
                  </div>

                  {/* Checklist */}
                  {task.steps && task.steps.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[#E9EDEF] mb-2">
                        Checklist ({task.steps.filter((s: any) => s.completedAt).length}/{task.steps.length})
                      </h4>
                      <div className="space-y-2">
                        {task.steps.map((step: any) => (
                          <div
                            key={step.id}
                            className={`flex items-center gap-3 bg-[#202C33] rounded-lg p-3 ${
                              !step.completedAt && canComplete ? 'cursor-pointer hover:bg-[#2A3942]' : ''
                            }`}
                            onClick={() => {
                              if (!step.completedAt && canComplete) {
                                completeStepMutation.mutate(step.id)
                              }
                            }}
                          >
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                step.completedAt
                                  ? 'bg-[#00A884] border-[#00A884]'
                                  : 'border-[#8696A0]'
                              }`}
                            >
                              {step.completedAt && <CheckIcon />}
                            </div>
                            <span
                              className={`flex-1 text-sm ${
                                step.completedAt ? 'text-[#8696A0] line-through' : 'text-[#E9EDEF]'
                              }`}
                            >
                              {step.content}
                              {step.isMandatory && (
                                <span className="text-[#EF4444] ml-1">*</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proofs */}
                  {task.proofs && task.proofs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[#E9EDEF] mb-2">
                        Proofs ({task.proofs.length})
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {task.proofs.map((proof: any) => (
                          <div
                            key={proof.id}
                            className="bg-[#202C33] rounded-lg p-2 text-center"
                          >
                            {proof.type === 'IMAGE' ? (
                              <img
                                src={proof.url}
                                alt="Proof"
                                className="w-full h-20 object-cover rounded"
                              />
                            ) : (
                              <div className="w-full h-20 flex items-center justify-center text-[#8696A0]">
                                <span className="text-2xl">
                                  {proof.type === 'VIDEO' ? '🎥' : proof.type === 'AUDIO' ? '🎵' : '📄'}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-[#8696A0] mt-1 truncate">
                              {proof.user?.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Activity Tab */
                <div className="space-y-3">
                  {task.activities && task.activities.length > 0 ? (
                    task.activities.map((activity: any) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#202C33] flex items-center justify-center text-[#8696A0] text-sm">
                          {getActivityIcon(activity.action)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-[#E9EDEF]">
                            <span className="font-medium">{activity.user?.name}</span>
                            {' '}
                            {activity.action === 'CREATED' && 'created this task'}
                            {activity.action === 'STATUS_CHANGED' && `changed status to ${activity.details?.to}`}
                            {activity.action === 'STEP_COMPLETED' && `completed "${activity.details?.stepContent}"`}
                            {activity.action === 'PROOF_UPLOADED' && 'uploaded proof'}
                            {activity.action === 'APPROVED' && 'approved this task'}
                            {activity.action === 'REOPENED' && 'reopened this task'}
                          </p>
                          <p className="text-xs text-[#8696A0]">
                            {formatMessageTime(activity.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-[#8696A0] py-8">No activity yet</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 bg-[#202C33] border-t border-[#3B4A54] space-y-3">
              {/* Task owner actions */}
              {isTaskOwner && task.status === TaskStatus.PENDING && (
                <button
                  onClick={() => updateStatusMutation.mutate(TaskStatus.IN_PROGRESS)}
                  disabled={updateStatusMutation.isPending}
                  className="w-full px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-sm font-medium hover:bg-[#F59E0B]/90 transition-colors disabled:opacity-50"
                >
                  {updateStatusMutation.isPending ? 'Updating...' : 'Start Working'}
                </button>
              )}

              {isTaskOwner && task.status === TaskStatus.IN_PROGRESS && (
                <button
                  onClick={() => updateStatusMutation.mutate(TaskStatus.COMPLETED)}
                  disabled={updateStatusMutation.isPending}
                  className="w-full px-4 py-2 bg-[#10B981] text-white rounded-lg text-sm font-medium hover:bg-[#10B981]/90 transition-colors disabled:opacity-50"
                >
                  {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Completed'}
                </button>
              )}

              {isTaskOwner && task.status === TaskStatus.REOPENED && (
                <button
                  onClick={() => updateStatusMutation.mutate(TaskStatus.IN_PROGRESS)}
                  disabled={updateStatusMutation.isPending}
                  className="w-full px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-sm font-medium hover:bg-[#F59E0B]/90 transition-colors disabled:opacity-50"
                >
                  {updateStatusMutation.isPending ? 'Updating...' : 'Resume Working'}
                </button>
              )}

              {/* Admin actions */}
              {canApprove && (
                <div className="flex gap-3">
                  <button
                    onClick={() => reopenMutation.mutate()}
                    disabled={reopenMutation.isPending}
                    className="flex-1 px-4 py-2 bg-[#8B5CF6] text-white rounded-lg text-sm font-medium hover:bg-[#8B5CF6]/90 transition-colors disabled:opacity-50"
                  >
                    {reopenMutation.isPending ? 'Reopening...' : 'Reopen'}
                  </button>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="flex-1 px-4 py-2 bg-[#059669] text-white rounded-lg text-sm font-medium hover:bg-[#059669]/90 transition-colors disabled:opacity-50"
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              )}

              {task.status === TaskStatus.APPROVED && (
                <div className="text-center text-[#059669] text-sm font-medium">
                  ✅ Task Approved
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-[#8696A0]">
            Task not found
          </div>
        )}
      </div>
    </div>
  )
}
