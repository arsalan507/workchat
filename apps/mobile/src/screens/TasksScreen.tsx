import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../services/api'
import TaskDetailsModal from '../components/task/TaskDetailsModal'

interface Task {
  id: string
  title: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REOPENED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  owner: {
    id: string
    name: string
  }
  createdAt: string
  message?: {
    chatId: string
  }
}

const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: '#3B82F6',
  IN_PROGRESS: '#EAB308',
  COMPLETED: '#22C55E',
  APPROVED: '#22C55E',
  REOPENED: '#A855F7',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6B7280',
  MEDIUM: '#3B82F6',
  HIGH: '#F97316',
  URGENT: '#EF4444',
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

  const fetchTasks = async () => {
    try {
      const response = await api.get('/api/tasks')
      setTasks(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchTasks()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchTasks()
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'ALL') return true
    return task.status === filter
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const closeTaskModal = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
  }

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity style={styles.taskItem} onPress={() => openTaskDetails(item)}>
      <View style={styles.taskHeader}>
        <View style={[styles.statusDot, { backgroundColor: TASK_STATUS_COLORS[item.status] }]} />
        <Text style={styles.taskTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
      <View style={styles.taskMeta}>
        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] + '20' }]}>
          <Text style={[styles.priorityText, { color: PRIORITY_COLORS[item.priority] }]}>
            {item.priority}
          </Text>
        </View>
        <Text style={styles.taskOwner}>{item.owner?.name}</Text>
        {item.dueDate && (
          <Text style={styles.taskDue}>Due: {formatDate(item.dueDate)}</Text>
        )}
      </View>
      <View style={styles.taskFooter}>
        <Text style={[styles.taskStatus, { color: TASK_STATUS_COLORS[item.status] }]}>
          {item.status.replace('_', ' ')}
        </Text>
        <Text style={styles.tapHint}>Tap to view details</Text>
      </View>
    </TouchableOpacity>
  )

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No tasks yet</Text>
      <Text style={styles.emptySubtitle}>Tasks will appear here when created from chats</Text>
    </View>
  )

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((f) => (
        <TouchableOpacity
          key={f}
          style={[styles.filterButton, filter === f && styles.filterButtonActive]}
          onPress={() => setFilter(f)}
        >
          <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
            {f === 'ALL' ? 'All' : f.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  return (
    <View style={styles.container}>
      {renderFilters()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, filteredTasks.length === 0 && styles.listContentEmpty]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#128C7E" />
          }
        />
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          visible={showTaskModal}
          onClose={closeTaskModal}
          taskId={selectedTask.id}
          chatId={selectedTask.message?.chatId || ''}
          onTaskUpdated={fetchTasks}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: '#128C7E',
  },
  filterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  listContentEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  taskItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
    marginTop: 4,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 20,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingLeft: 20,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskOwner: {
    fontSize: 13,
    color: '#6B7280',
  },
  taskDue: {
    fontSize: 13,
    color: '#6B7280',
  },
  taskFooter: {
    paddingLeft: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 11,
    color: '#9CA3AF',
  },
})
