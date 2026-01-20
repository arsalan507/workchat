import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import { formatMessageTime, Message, MessageType, TaskStatus, TASK_STATUS_COLORS } from '@workchat/shared'

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch chat details
  const { data: chat } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      const response = await api.get(`/api/chats/${chatId}`)
      return response.data.data
    },
  })

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      const response = await api.get(`/api/chats/${chatId}/messages`)
      return response.data
    },
  })

  const messages = messagesData?.data || []

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post(`/api/chats/${chatId}/messages`, {
        content,
        type: MessageType.TEXT,
      })
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      setMessageText('')
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim()) return
    sendMessageMutation.mutate(messageText.trim())
  }

  const getStatusColor = (status: TaskStatus) => {
    return TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS.PENDING
  }

  return (
    <div className="h-screen flex flex-col bg-chat-bg">
      {/* Header */}
      <header className="bg-whatsapp-green-dark text-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-1 hover:bg-white/10 rounded-full"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white font-medium">
          {chat?.name?.charAt(0).toUpperCase() || '?'}
        </div>

        <div className="flex-1">
          <h1 className="font-medium">{chat?.name || 'Loading...'}</h1>
          <p className="text-xs opacity-75">
            {chat?.members?.length || 0} members
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 chat-bg">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-whatsapp-green border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          [...messages].reverse().map((message: any) => {
            const isOwn = message.senderId === user?.id
            const isTask = message.isTask

            return (
              <div
                key={message.id}
                className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[65%] rounded-bubble px-3 py-2 shadow-message
                    ${isOwn
                      ? 'bg-chat-outgoing rounded-tr-none'
                      : 'bg-chat-incoming rounded-tl-none'
                    }
                    ${isTask ? 'border-l-4' : ''}
                  `}
                  style={isTask ? { borderLeftColor: getStatusColor(message.task?.status) } : {}}
                >
                  {/* Sender name (for group chats) */}
                  {!isOwn && chat?.type === 'GROUP' && (
                    <p className="text-xs font-medium text-whatsapp-green-dark mb-1">
                      {message.sender?.name}
                    </p>
                  )}

                  {/* Message content */}
                  <p className="text-message text-gray-900 whitespace-pre-wrap">
                    {message.content}
                  </p>

                  {/* Task indicator */}
                  {isTask && message.task && (
                    <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-200">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getStatusColor(message.task.status) }}
                      />
                      <span className="text-xs text-gray-500">
                        {message.task.status.replace('_', ' ')}
                      </span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-timestamp text-gray-500">
                      {formatMessageTime(message.createdAt)}
                    </span>
                    {isOwn && (
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSend} className="bg-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          className="p-2 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a message"
          className="flex-1 bg-white rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-whatsapp-green"
        />

        <button
          type="submit"
          disabled={!messageText.trim() || sendMessageMutation.isPending}
          className="p-2 text-whatsapp-green disabled:text-gray-400"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
