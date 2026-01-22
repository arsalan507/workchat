import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { api } from '../services/api'

interface Activity {
  id: string
  action: string
  taskId: string
  task?: {
    title: string
  }
  user?: {
    name: string
  }
  details?: any
  createdAt: string
}

const ACTION_ICONS: Record<string, string> = {
  CREATED: '📋',
  STATUS_CHANGED: '🔄',
  STEP_COMPLETED: '✅',
  PROOF_UPLOADED: '📷',
  APPROVED: '✨',
  REOPENED: '🔄',
}

export default function UpdatesScreen() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchActivities = async () => {
    try {
      const response = await api.get('/api/tasks/activities')
      setActivities(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch activities:', error)
      // If the endpoint doesn't exist yet, just show empty
      setActivities([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchActivities()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchActivities()
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getActionText = (activity: Activity) => {
    const userName = activity.user?.name || 'Someone'
    const taskTitle = activity.task?.title || 'a task'

    switch (activity.action) {
      case 'CREATED':
        return `${userName} created task "${taskTitle}"`
      case 'STATUS_CHANGED':
        return `${userName} updated "${taskTitle}"`
      case 'STEP_COMPLETED':
        return `${userName} completed a step in "${taskTitle}"`
      case 'PROOF_UPLOADED':
        return `${userName} uploaded proof for "${taskTitle}"`
      case 'APPROVED':
        return `${userName} approved "${taskTitle}"`
      case 'REOPENED':
        return `${userName} reopened "${taskTitle}"`
      default:
        return `${userName} updated "${taskTitle}"`
    }
  }

  const renderActivity = ({ item }: { item: Activity }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityIcon}>
        <Text style={styles.activityIconText}>{ACTION_ICONS[item.action] || '📋'}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityText}>{getActionText(item)}</Text>
        <Text style={styles.activityTime}>{formatTime(item.createdAt)}</Text>
      </View>
    </View>
  )

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No updates yet</Text>
      <Text style={styles.emptySubtitle}>Activity from your tasks will appear here</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, activities.length === 0 && styles.listContentEmpty]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#128C7E" />
          }
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
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
  activityItem: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 18,
  },
  activityContent: {
    flex: 1,
    justifyContent: 'center',
  },
  activityText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
})
