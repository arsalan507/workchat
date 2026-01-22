import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'

interface Chat {
  id: string
  name: string
  type: 'DIRECT' | 'GROUP'
  lastMessage?: {
    content: string
    type: string
    createdAt: string
    senderName?: string
  }
  members?: Array<{
    userId: string
    user: {
      id: string
      name: string
    }
  }>
  updatedAt?: string
  createdAt?: string
}

export default function ChatListScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchChats = async () => {
    try {
      console.log('[ChatList] Fetching chats...')
      const response = await api.get('/api/chats')
      console.log('[ChatList] Response:', JSON.stringify(response.data, null, 2))
      const chatData = response.data.data || []
      console.log('[ChatList] Chats count:', chatData.length)
      setChats(chatData)
    } catch (error: any) {
      console.error('[ChatList] Failed to fetch chats:', error.message)
      console.error('[ChatList] Error details:', error.response?.data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Fetch on mount
  useEffect(() => {
    fetchChats()
  }, [])

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchChats()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchChats()
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getLastMessagePreview = (chat: Chat) => {
    if (!chat.lastMessage) return 'No messages yet'

    const { type, content, senderName } = chat.lastMessage
    const prefix = chat.type === 'GROUP' && senderName ? `${senderName}: ` : ''

    switch (type) {
      case 'TEXT':
        return prefix + (content || '')
      case 'IMAGE':
        return prefix + '📷 Photo'
      case 'VIDEO':
        return prefix + '🎥 Video'
      case 'AUDIO':
        return prefix + '🎵 Audio'
      case 'FILE':
        return prefix + '📄 File'
      default:
        return prefix + (content || '')
    }
  }

  const getChatDisplayName = (chat: Chat) => {
    if (chat.type === 'GROUP') return chat.name

    // For direct chats, show the other person's name
    const otherMember = chat.members?.find((m) => m.user.id !== user?.id)
    return otherMember?.user.name || chat.name
  }

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true
    const displayName = getChatDisplayName(chat)
    return displayName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => (navigation as any).navigate('Chat', { chatId: item.id, chatName: getChatDisplayName(item) })}
    >
      <View style={[styles.avatar, item.type === 'GROUP' && styles.groupAvatar]}>
        <Text style={styles.avatarText}>{getChatDisplayName(item).charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>
            {getChatDisplayName(item)}
          </Text>
          <Text style={styles.chatTime}>
            {item.lastMessage?.createdAt ? formatTime(item.lastMessage.createdAt) : (item.updatedAt ? formatTime(item.updatedAt) : '')}
          </Text>
        </View>
        <Text style={styles.chatLastMessage} numberOfLines={1}>
          {getLastMessagePreview(item)}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No chats yet</Text>
      <Text style={styles.emptySubtitle}>Start a conversation to see it here</Text>
    </View>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WorkChat</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <TextInput
            placeholder="Search chats..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchTextInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Chat List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChat}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, filteredChats.length === 0 && styles.listContentEmpty]}
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
  header: {
    backgroundColor: '#128C7E',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  searchContainer: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchTextInput: {
    color: '#111827',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 20,
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupAvatar: {
    backgroundColor: '#25D366',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  chatLastMessage: {
    fontSize: 14,
    color: '#6B7280',
  },
})
