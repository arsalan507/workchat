import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../services/api'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'
import ConvertToTaskModal from '../components/chat/ConvertToTaskModal'
import TaskDetailsModal from '../components/task/TaskDetailsModal'

interface Message {
  id: string
  content: string
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'
  fileUrl?: string
  senderId: string
  sender?: {
    id: string
    name: string
  }
  createdAt: string
  isTask: boolean
  task?: {
    id: string
    status: string
    title: string
  }
  replyTo?: {
    content: string
    sender?: {
      name: string
    }
  }
}

interface RouteParams {
  chatId: string
  chatName?: string
}

const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: '#3B82F6',
  IN_PROGRESS: '#EAB308',
  COMPLETED: '#22C55E',
  APPROVED: '#22C55E',
  REOPENED: '#A855F7',
}

export default function ChatScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { chatId, chatName } = route.params as RouteParams
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId)

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<any>(null)
  const flatListRef = useRef<FlatList>(null)

  // Long-press menu state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showMessageMenu, setShowMessageMenu] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)

  // Task details modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/api/chats/${chatId}/messages`)
      // Messages come in reverse chronological order, reverse for display
      setMessages((response.data.data || []).reverse())
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChat = async () => {
    try {
      const response = await api.get(`/api/chats/${chatId}`)
      setChat(response.data.data)
    } catch (error) {
      console.error('Failed to fetch chat:', error)
    }
  }

  useEffect(() => {
    // Track current chat for notification suppression
    setCurrentChatId(chatId)

    fetchChat()
    fetchMessages()

    // Join the chat room for real-time updates
    socketService.joinChat(chatId)

    // Listen for new messages
    const unsubscribeNewMessage = socketService.on('new_message', (data: { chatId: string; message: Message }) => {
      if (data.chatId === chatId) {
        // Skip if this is our own message - we already added it when sending
        if (data.message.senderId === user?.id) {
          return
        }
        // Only add message if it doesn't already exist
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id)
          if (exists) return prev
          return [...prev, data.message]
        })
      }
    })

    // Listen for task conversions
    const unsubscribeTaskConversion = socketService.on('message_converted_to_task', (data: { chatId: string; messageId: string; task: any }) => {
      if (data.chatId === chatId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, isTask: true, task: data.task }
              : m
          )
        )
      }
    })

    return () => {
      setCurrentChatId(null)
      socketService.leaveChat(chatId)
      unsubscribeNewMessage()
      unsubscribeTaskConversion()
    }
  }, [chatId])

  // Refresh messages when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchMessages()
      // Rejoin chat room when screen comes into focus
      socketService.joinChat(chatId)
    }, [chatId])
  )

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages])

  const handleSend = async () => {
    if (!message.trim() || sending) return

    setSending(true)
    try {
      const response = await api.post(`/api/chats/${chatId}/messages`, {
        content: message.trim(),
        type: 'TEXT',
      })

      // Add new message to list
      setMessages((prev) => [...prev, response.data.data])
      setMessage('')

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const getDisplayName = () => {
    if (chatName) return chatName
    if (!chat) return 'Loading...'

    if (chat.type === 'GROUP') return chat.name

    // For direct chats, show other person's name
    const otherMember = chat.members?.find((m: any) => m.user.id !== user?.id)
    return otherMember?.user.name || chat.name
  }

  const getMemberCount = () => {
    if (!chat?.members) return ''
    return `${chat.members.length} members`
  }

  // Check if current user is admin/owner of the chat (can convert messages to tasks)
  const canConvertToTask = () => {
    if (!chat?.members || !user) return false
    const currentMember = chat.members.find((m: any) => m.user.id === user.id)
    return currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN'
  }

  // Long-press handler for messages
  const handleMessageLongPress = (msg: Message) => {
    // Only show menu if not already a task and user can convert
    if (!msg.isTask && canConvertToTask()) {
      setSelectedMessage(msg)
      setShowMessageMenu(true)
    }
  }

  // Handle convert to task action
  const handleConvertToTask = () => {
    setShowMessageMenu(false)
    setShowConvertModal(true)
  }

  // Handle successful task conversion
  const handleTaskConversionSuccess = () => {
    setShowConvertModal(false)
    setSelectedMessage(null)
    fetchMessages() // Refresh messages to show the task
  }

  // Close message menu
  const closeMessageMenu = () => {
    setShowMessageMenu(false)
    setSelectedMessage(null)
  }

  // Get current user's role in the chat
  const getCurrentMemberRole = (): 'OWNER' | 'ADMIN' | 'MEMBER' | undefined => {
    if (!chat?.members || !user) return undefined
    const currentMember = chat.members.find((m: any) => m.user.id === user.id)
    return currentMember?.role
  }

  // Handle task tap to open details modal
  const handleTaskPress = (msg: Message) => {
    if (msg.isTask && msg.task?.id) {
      setSelectedTaskId(msg.task.id)
      setShowTaskModal(true)
    }
  }

  // Close task details modal
  const closeTaskModal = () => {
    setShowTaskModal(false)
    setSelectedTaskId(null)
  }

  // Handle task update from modal
  const handleTaskUpdated = () => {
    fetchMessages() // Refresh messages to show updated task status
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id
    const canShowMenu = !item.isTask && canConvertToTask()
    const isTask = item.isTask && item.task

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => isTask && handleTaskPress(item)}
        onLongPress={() => canShowMenu && handleMessageLongPress(item)}
        delayLongPress={500}
        style={[styles.messageContainer, isOwn ? styles.messageOwn : styles.messageOther]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            isTask && { borderLeftWidth: 4, borderLeftColor: TASK_STATUS_COLORS[item.task?.status || 'PENDING'] },
          ]}
        >
          {/* Sender name for group chats */}
          {!isOwn && chat?.type === 'GROUP' && (
            <Text style={styles.senderName}>{item.sender?.name}</Text>
          )}

          {/* Reply reference */}
          {item.replyTo && (
            <View style={styles.replyContainer}>
              <Text style={styles.replyName}>{item.replyTo.sender?.name || 'Unknown'}</Text>
              <Text style={styles.replyContent} numberOfLines={1}>{item.replyTo.content}</Text>
            </View>
          )}

          {/* Media content */}
          {item.type === 'IMAGE' && item.fileUrl && (
            <Image source={{ uri: item.fileUrl }} style={styles.messageImage} resizeMode="cover" />
          )}

          {/* Text content */}
          {item.content && (
            <Text style={styles.messageText}>{item.content}</Text>
          )}

          {/* Task indicator */}
          {isTask && (
            <View style={styles.taskIndicator}>
              <View style={[styles.taskDot, { backgroundColor: TASK_STATUS_COLORS[item.task!.status] }]} />
              <Text style={styles.taskStatus}>{item.task!.status.replace('_', ' ')}</Text>
              <Text style={styles.taskTapHint}> - Tap to view</Text>
            </View>
          )}

          {/* Timestamp */}
          <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={[styles.headerAvatar, chat?.type === 'GROUP' && styles.groupAvatar]}>
          <Text style={styles.headerAvatarText}>{getDisplayName().charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{getDisplayName()}</Text>
          {chat?.type === 'GROUP' && (
            <Text style={styles.headerSubtitle}>{getMemberCount()}</Text>
          )}
        </View>
      </View>

      {/* Messages */}
      <View style={styles.messagesContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#128C7E" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.messagesList, messages.length === 0 && styles.messagesListEmpty]}
            ListEmptyComponent={renderEmpty}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}
      </View>

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.attachButton}>
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor="#9CA3AF"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!message.trim() || sending) && styles.sendButtonDisabled]}
          disabled={!message.trim() || sending}
          onPress={handleSend}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#25D366" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Message Action Menu */}
      <Modal
        visible={showMessageMenu}
        transparent
        animationType="fade"
        onRequestClose={closeMessageMenu}
      >
        <Pressable style={styles.menuOverlay} onPress={closeMessageMenu}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Message Options</Text>
            {selectedMessage && (
              <View style={styles.menuMessagePreview}>
                <Text style={styles.menuMessageText} numberOfLines={2}>
                  {selectedMessage.content}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleConvertToTask}>
              <Text style={styles.menuItemIcon}>📋</Text>
              <Text style={styles.menuItemText}>Convert to Task</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancelButton} onPress={closeMessageMenu}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Convert to Task Modal */}
      <ConvertToTaskModal
        visible={showConvertModal}
        onClose={() => {
          setShowConvertModal(false)
          setSelectedMessage(null)
        }}
        message={selectedMessage ? {
          id: selectedMessage.id,
          content: selectedMessage.content || '',
          chatId: chatId,
        } : null}
        members={chat?.members || []}
        onSuccess={handleTaskConversionSuccess}
      />

      {/* Task Details Modal */}
      {selectedTaskId && (
        <TaskDetailsModal
          visible={showTaskModal}
          onClose={closeTaskModal}
          taskId={selectedTaskId}
          chatId={chatId}
          memberRole={getCurrentMemberRole()}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECE5DD',
  },
  header: {
    backgroundColor: '#128C7E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  groupAvatar: {
    backgroundColor: '#25D366',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 13,
  },
  messagesContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 8,
    paddingBottom: 16,
  },
  messagesListEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 2,
  },
  messageOwn: {
    alignItems: 'flex-end',
  },
  messageOther: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  bubbleOwn: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 0,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#128C7E',
    marginBottom: 2,
  },
  replyContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 2,
    borderLeftColor: '#128C7E',
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 4,
    borderRadius: 4,
  },
  replyName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#128C7E',
  },
  replyContent: {
    fontSize: 12,
    color: '#6B7280',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  taskIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  taskStatus: {
    fontSize: 11,
    color: '#6B7280',
  },
  taskTapHint: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#F3F4F6',
  },
  attachButton: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 24,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#111827',
  },
  sendButton: {
    padding: 8,
    marginLeft: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    fontSize: 24,
    color: '#25D366',
  },
  // Message menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    padding: 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  menuMessagePreview: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#128C7E',
  },
  menuMessageText: {
    fontSize: 14,
    color: '#374151',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  menuCancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  menuCancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
})
