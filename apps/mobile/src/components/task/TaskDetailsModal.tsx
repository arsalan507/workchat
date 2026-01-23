import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

interface TaskDetailsModalProps {
  visible: boolean
  onClose: () => void
  taskId: string
  chatId: string
  memberRole?: string
  onTaskUpdated?: () => void
}

interface Task {
  id: string
  title: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REOPENED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  ownerId: string
  owner: { id: string; name: string }
  createdBy: { id: string; name: string }
  steps?: Array<{
    id: string
    content: string
    isMandatory: boolean
    completedAt?: string
  }>
  activities?: Array<{
    id: string
    action: string
    user: { name: string }
    details?: any
    createdAt: string
  }>
  messageContent?: string
  isOverdue?: boolean
}

const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: '#3B82F6',
  IN_PROGRESS: '#EAB308',
  COMPLETED: '#22C55E',
  APPROVED: '#059669',
  REOPENED: '#A855F7',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6B7280',
  MEDIUM: '#3B82F6',
  HIGH: '#F97316',
  URGENT: '#EF4444',
}

export default function TaskDetailsModal({
  visible,
  onClose,
  taskId,
  chatId,
  memberRole,
  onTaskUpdated,
}: TaskDetailsModalProps) {
  const user = useAuthStore((state) => state.user)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')

  const isGroupAdmin = memberRole === 'OWNER' || memberRole === 'ADMIN'
  const isTaskOwner = task?.ownerId === user?.id

  useEffect(() => {
    if (visible && taskId) {
      fetchTask()
    }
  }, [visible, taskId])

  const fetchTask = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/tasks/${taskId}`)
      setTask(response.data.data)
    } catch (error) {
      console.error('Failed to fetch task:', error)
      Alert.alert('Error', 'Failed to load task details')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus })
      await fetchTask()
      onTaskUpdated?.()
    } catch (error: any) {
      console.error('Failed to update status:', error)
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update task status')
    } finally {
      setUpdating(false)
    }
  }

  const completeStep = async (stepId: string) => {
    try {
      await api.post(`/api/tasks/${taskId}/steps/${stepId}/complete`)
      await fetchTask()
    } catch (error: any) {
      console.error('Failed to complete step:', error)
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to complete step')
    }
  }

  const approveTask = async () => {
    setUpdating(true)
    try {
      await api.post(`/api/tasks/${taskId}/approve`)
      await fetchTask()
      onTaskUpdated?.()
    } catch (error: any) {
      console.error('Failed to approve task:', error)
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to approve task')
    } finally {
      setUpdating(false)
    }
  }

  const reopenTask = async () => {
    setUpdating(true)
    try {
      await api.post(`/api/tasks/${taskId}/reopen`)
      await fetchTask()
      onTaskUpdated?.()
    } catch (error: any) {
      console.error('Failed to reopen task:', error)
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to reopen task')
    } finally {
      setUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActivityText = (activity: any) => {
    switch (activity.action) {
      case 'CREATED':
        return 'created this task'
      case 'STATUS_CHANGED':
        return `changed status to ${activity.details?.to?.replace('_', ' ')}`
      case 'STEP_COMPLETED':
        return `completed "${activity.details?.stepContent}"`
      case 'PROOF_UPLOADED':
        return 'uploaded proof'
      case 'APPROVED':
        return 'approved this task'
      case 'REOPENED':
        return 'reopened this task'
      default:
        return activity.action
    }
  }

  const canStartWorking = isTaskOwner && task?.status === 'PENDING'
  const canMarkComplete = isTaskOwner && task?.status === 'IN_PROGRESS'
  const canResumeWorking = isTaskOwner && task?.status === 'REOPENED'
  const canApprove = isGroupAdmin && task?.status === 'COMPLETED'

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>X</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Task Details</Text>
            {task && (
              <View style={[styles.statusBadge, { backgroundColor: TASK_STATUS_COLORS[task.status] }]}>
                <Text style={styles.statusBadgeText}>{task.status.replace('_', ' ')}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#128C7E" />
            </View>
          ) : task ? (
            <>
              {/* Tabs */}
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'details' && styles.tabActive]}
                  onPress={() => setActiveTab('details')}
                >
                  <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
                    Details
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
                  onPress={() => setActiveTab('activity')}
                >
                  <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
                    Activity ({task.activities?.length || 0})
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content}>
                {activeTab === 'details' ? (
                  <>
                    {/* Title */}
                    <View style={styles.section}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {task.messageContent && (
                        <Text style={styles.taskDescription}>{task.messageContent}</Text>
                      )}
                    </View>

                    {/* Meta info */}
                    <View style={styles.metaGrid}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Assigned to</Text>
                        <View style={styles.metaValueRow}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {task.owner?.name?.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.metaValue}>{task.owner?.name}</Text>
                        </View>
                      </View>

                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Priority</Text>
                        <View
                          style={[
                            styles.priorityBadge,
                            { backgroundColor: PRIORITY_COLORS[task.priority] + '20' },
                          ]}
                        >
                          <Text style={[styles.priorityText, { color: PRIORITY_COLORS[task.priority] }]}>
                            {task.priority}
                          </Text>
                        </View>
                      </View>

                      {task.dueDate && (
                        <View style={styles.metaItem}>
                          <Text style={styles.metaLabel}>Due date</Text>
                          <Text style={[styles.metaValue, task.isOverdue && styles.overdueText]}>
                            {formatDate(task.dueDate)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Created by</Text>
                        <Text style={styles.metaValue}>{task.createdBy?.name}</Text>
                      </View>
                    </View>

                    {/* Checklist */}
                    {task.steps && task.steps.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                          Checklist ({task.steps.filter((s) => s.completedAt).length}/{task.steps.length})
                        </Text>
                        {task.steps.map((step) => (
                          <TouchableOpacity
                            key={step.id}
                            style={styles.stepItem}
                            onPress={() => {
                              if (!step.completedAt && isTaskOwner) {
                                completeStep(step.id)
                              }
                            }}
                            disabled={!!step.completedAt || !isTaskOwner}
                          >
                            <View
                              style={[
                                styles.checkbox,
                                !!step.completedAt && styles.checkboxChecked,
                              ]}
                            >
                              {!!step.completedAt && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text
                              style={[
                                styles.stepText,
                                !!step.completedAt && styles.stepTextCompleted,
                              ]}
                            >
                              {step.content}
                              {step.isMandatory && <Text style={styles.mandatory}> *</Text>}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  /* Activity Tab */
                  <View style={styles.section}>
                    {task.activities && task.activities.length > 0 ? (
                      task.activities.map((activity) => (
                        <View key={activity.id} style={styles.activityItem}>
                          <View style={styles.activityIcon}>
                            <Text style={styles.activityIconText}>
                              {activity.action === 'CREATED' && '+'}
                              {activity.action === 'STATUS_CHANGED' && '→'}
                              {activity.action === 'STEP_COMPLETED' && '✓'}
                              {activity.action === 'APPROVED' && '✓'}
                              {activity.action === 'REOPENED' && '↩'}
                            </Text>
                          </View>
                          <View style={styles.activityContent}>
                            <Text style={styles.activityText}>
                              <Text style={styles.activityUser}>{activity.user?.name}</Text>
                              {' '}{getActivityText(activity)}
                            </Text>
                            <Text style={styles.activityTime}>
                              {formatDate(activity.createdAt)}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No activity yet</Text>
                    )}
                  </View>
                )}
              </ScrollView>

              {/* Footer actions */}
              <View style={styles.footer}>
                {canStartWorking && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.startButton]}
                    onPress={() => updateStatus('IN_PROGRESS')}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionButtonText}>Start Working</Text>
                    )}
                  </TouchableOpacity>
                )}

                {canMarkComplete && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton]}
                    onPress={() => updateStatus('COMPLETED')}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionButtonText}>Mark as Completed</Text>
                    )}
                  </TouchableOpacity>
                )}

                {canResumeWorking && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.startButton]}
                    onPress={() => updateStatus('IN_PROGRESS')}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionButtonText}>Resume Working</Text>
                    )}
                  </TouchableOpacity>
                )}

                {canApprove && (
                  <View style={styles.adminActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.reopenButton, { flex: 1, marginRight: 8 }]}
                      onPress={reopenTask}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionButtonText}>Reopen</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton, { flex: 1 }]}
                      onPress={approveTask}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionButtonText}>Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {task.status === 'APPROVED' && (
                  <View style={styles.approvedBanner}>
                    <Text style={styles.approvedText}>Task Approved</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>Task not found</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#128C7E',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#128C7E',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  taskDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  metaItem: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#111827',
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  overdueText: {
    color: '#EF4444',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  stepTextCompleted: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  mandatory: {
    color: '#EF4444',
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#374151',
  },
  activityUser: {
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    paddingVertical: 20,
  },
  errorText: {
    color: '#6B7280',
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  startButton: {
    backgroundColor: '#F59E0B',
  },
  completeButton: {
    backgroundColor: '#10B981',
  },
  reopenButton: {
    backgroundColor: '#8B5CF6',
  },
  approveButton: {
    backgroundColor: '#059669',
  },
  adminActions: {
    flexDirection: 'row',
  },
  approvedBanner: {
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approvedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
})
