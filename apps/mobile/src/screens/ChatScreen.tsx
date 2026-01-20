import { useState, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Placeholder messages
const PLACEHOLDER_MESSAGES = [
  { id: '1', content: 'Good morning team!', senderId: 'admin', createdAt: '10:30' },
  { id: '2', content: 'Good morning!', senderId: 'me', createdAt: '10:31' },
  { id: '3', content: 'Please complete the inventory count today.', senderId: 'admin', createdAt: '10:32', isTask: true, status: 'PENDING' },
]

export default function ChatScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const [message, setMessage] = useState('')
  const flatListRef = useRef<FlatList>(null)

  const renderMessage = ({ item }: { item: typeof PLACEHOLDER_MESSAGES[0] }) => {
    const isOwn = item.senderId === 'me'

    return (
      <View style={[styles.messageContainer, isOwn ? styles.messageOwn : styles.messageOther]}>
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            item.isTask && styles.taskBubble,
          ]}
        >
          <Text style={styles.messageText}>{item.content}</Text>
          {item.isTask && (
            <View style={styles.taskIndicator}>
              <View style={[styles.taskDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.taskStatus}>{item.status}</Text>
            </View>
          )}
          <Text style={styles.messageTime}>{item.createdAt}</Text>
        </View>
      </View>
    )
  }

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
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>O</Text>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Operations Team</Text>
          <Text style={styles.headerSubtitle}>5 members</Text>
        </View>
      </View>

      {/* Messages */}
      <View style={styles.messagesContainer}>
        <FlatList
          ref={flatListRef}
          data={PLACEHOLDER_MESSAGES}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
        />
      </View>

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.attachButton}>
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
          disabled={!message.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
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
  messagesList: {
    padding: 8,
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
  taskBubble: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
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
})
