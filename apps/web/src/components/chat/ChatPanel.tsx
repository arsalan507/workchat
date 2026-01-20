import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../services/api'
import { formatMessageTime, MessageType, TaskStatus, TASK_STATUS_COLORS, ChatMemberRole } from '@workchat/shared'
import ConvertToTaskModal from './ConvertToTaskModal'
import TaskDetailsModal from '../task/TaskDetailsModal'

// Icons
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
  </svg>
)

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/>
  </svg>
)

const AttachIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 003.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.501.501 1.155.812 1.805.869.681.06 1.298-.161 1.728-.59l5.522-5.524.472.471-5.522 5.523c-.576.577-1.381.884-2.26.808-.941-.081-1.861-.471-2.524-1.136-1.336-1.336-1.469-3.231-.299-4.404l7.916-7.916c1.097-1.097 2.91-1.004 4.103.191.594.594.967 1.332 1.024 2.036.058.692-.227 1.392-.796 1.961l-9.548 9.548a3.953 3.953 0 01-2.827 1.168 3.96 3.96 0 01-2.826-1.17 3.96 3.96 0 01-1.17-2.826 3.96 3.96 0 011.17-2.826L12.793 5.25l.471.471-8.37 8.369a2.332 2.332 0 00-.686 1.665z"/>
  </svg>
)

const EmojiIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z"/>
  </svg>
)

const MicIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2z"/>
  </svg>
)

const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/>
  </svg>
)

const DoubleCheckIcon = ({ read }: { read?: boolean }) => (
  <svg viewBox="0 0 16 11" className={`w-4 h-4 ${read ? 'text-[#53BDEB]' : 'text-[#8696A0]'}`} fill="currentColor">
    <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 00-.336-.146.47.47 0 00-.343.146l-.311.31a.445.445 0 00-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 00.514.211.692.692 0 00.543-.273l6.571-8.117a.45.45 0 00.102-.304.498.498 0 00-.178-.38l-.278-.223zm2.325 0a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-1.152-1.088-.406.469 1.718 1.718c.138.139.3.208.485.208a.69.69 0 00.57-.3l6.542-8.09a.45.45 0 00.102-.305.498.498 0 00-.178-.38l-.278-.222-.528-.722z"/>
  </svg>
)

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
  </svg>
)

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
)

const FileIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
  </svg>
)

const ReplyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
  </svg>
)

export default function ChatPanel() {
  const { chatId } = useParams<{ chatId: string }>()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedMessage, setSelectedMessage] = useState<any>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

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

  // Check if current user is admin/owner of this chat
  const currentMember = chat?.members?.find((m: any) => m.userId === user?.id)
  const isGroupAdmin = currentMember?.role === ChatMemberRole.OWNER || currentMember?.role === ChatMemberRole.ADMIN

  const handleConvertToTask = (message: any) => {
    setSelectedMessage(message)
    setShowConvertModal(true)
  }

  const handleOpenTaskDetails = (taskId: string) => {
    setSelectedTaskId(taskId)
    setShowTaskDetailsModal(true)
  }

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content?: string; type: MessageType; fileUrl?: string; replyToId?: string }) => {
      const response = await api.post(`/api/chats/${chatId}/messages`, data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      setMessageText('')
      setReplyingTo(null)
    },
  })

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data.data
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [chatId])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim()) return
    sendMessageMutation.mutate({
      content: messageText.trim(),
      type: MessageType.TEXT,
      replyToId: replyingTo?.id,
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    setShowAttachMenu(false)

    try {
      const uploadResult = await uploadFileMutation.mutateAsync(file)
      await sendMessageMutation.mutateAsync({
        type,
        fileUrl: uploadResult.url,
        replyToId: replyingTo?.id,
      })
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleReply = (message: any) => {
    setReplyingTo(message)
    inputRef.current?.focus()
  }

  const getStatusColor = (status: TaskStatus) => {
    return TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS.PENDING
  }

  // Group messages by date
  const groupedMessages = [...messages].reverse().reduce((groups: any[], message: any) => {
    const date = new Date(message.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.date === date) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ date, messages: [message] })
    }
    return groups
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-[60px] px-4 flex items-center gap-3 bg-[#202C33] border-b border-[#222D34]">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#6B7C85] flex items-center justify-center text-white font-medium">
          {chat?.name?.charAt(0).toUpperCase() || '?'}
        </div>

        {/* Chat info */}
        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-[#E9EDEF] truncate">
            {chat?.name || 'Loading...'}
          </h2>
          <p className="text-xs text-[#8696A0] truncate">
            {chat?.members?.map((m: any) => m.user?.name).join(', ') || 'Loading members...'}
          </p>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-[#AEBAC1] hover:text-white transition-colors">
            <SearchIcon />
          </button>
          <button className="p-2 text-[#AEBAC1] hover:text-white transition-colors">
            <MenuIcon />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-16 py-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23182229' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundColor: '#0B141A',
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#00A884] border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center bg-[#182229] rounded-lg px-4 py-2">
              <p className="text-[#8696A0] text-sm">
                No messages yet. Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          groupedMessages.map((group: any, groupIndex: number) => (
            <div key={groupIndex}>
              {/* Date divider */}
              <div className="flex justify-center my-4">
                <span className="bg-[#182229] text-[#8696A0] text-xs px-3 py-1.5 rounded-lg shadow">
                  {group.date}
                </span>
              </div>

              {/* Messages */}
              {group.messages.map((message: any) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === user?.id}
                  chatType={chat?.type}
                  isGroupAdmin={isGroupAdmin}
                  onConvertToTask={handleConvertToTask}
                  onOpenTaskDetails={handleOpenTaskDetails}
                  onReply={handleReply}
                />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-[#1F2C34] border-t border-[#3B4A54] flex items-center gap-3">
          <div className="w-1 h-10 bg-[#00A884] rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#00A884] font-medium">
              {replyingTo.sender?.name || 'You'}
            </p>
            <p className="text-sm text-[#8696A0] truncate">
              {replyingTo.type === MessageType.TEXT
                ? replyingTo.content
                : replyingTo.type === MessageType.IMAGE
                  ? '📷 Photo'
                  : replyingTo.type === MessageType.VIDEO
                    ? '🎥 Video'
                    : replyingTo.type === MessageType.AUDIO
                      ? '🎵 Audio'
                      : '📄 File'
              }
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-[#8696A0] hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Message input */}
      <div className="px-4 py-3 bg-[#202C33] border-t border-[#222D34]">
        {uploadingFile && (
          <div className="mb-2 flex items-center gap-2 text-[#8696A0] text-sm">
            <div className="animate-spin w-4 h-4 border-2 border-[#00A884] border-t-transparent rounded-full" />
            Uploading...
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
          >
            <EmojiIcon />
          </button>

          {/* Attach menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
            >
              <AttachIcon />
            </button>

            {showAttachMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAttachMenu(false)}
                />
                <div className="absolute bottom-full left-0 mb-2 bg-[#233138] rounded-lg shadow-lg py-2 z-20 w-48">
                  <label className="flex items-center gap-3 px-4 py-2 text-[#E9EDEF] hover:bg-[#3B4A54] cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-[#BF59CF] flex items-center justify-center">
                      <ImageIcon />
                    </div>
                    <span className="text-sm">Photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, MessageType.IMAGE)}
                    />
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2 text-[#E9EDEF] hover:bg-[#3B4A54] cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-[#D3396D] flex items-center justify-center">
                      <VideoIcon />
                    </div>
                    <span className="text-sm">Videos</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, MessageType.VIDEO)}
                    />
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2 text-[#E9EDEF] hover:bg-[#3B4A54] cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-[#0795DC] flex items-center justify-center">
                      <FileIcon />
                    </div>
                    <span className="text-sm">Document</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, MessageType.FILE)}
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 bg-[#2A3942] text-[#E9EDEF] placeholder-[#8696A0] rounded-lg px-4 py-2.5 outline-none text-sm"
          />

          {messageText.trim() ? (
            <button
              type="submit"
              disabled={sendMessageMutation.isPending}
              className="p-2 text-[#8696A0] hover:text-[#00A884] transition-colors disabled:opacity-50"
            >
              <SendIcon />
            </button>
          ) : (
            <button
              type="button"
              className="p-2 text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
            >
              <MicIcon />
            </button>
          )}
        </form>
      </div>

      {/* Convert to Task Modal */}
      {selectedMessage && (
        <ConvertToTaskModal
          isOpen={showConvertModal}
          onClose={() => {
            setShowConvertModal(false)
            setSelectedMessage(null)
          }}
          message={{
            id: selectedMessage.id,
            content: selectedMessage.content,
            chatId: chatId!,
          }}
          members={chat?.members || []}
        />
      )}

      {/* Task Details Modal */}
      {selectedTaskId && (
        <TaskDetailsModal
          isOpen={showTaskDetailsModal}
          onClose={() => {
            setShowTaskDetailsModal(false)
            setSelectedTaskId(null)
          }}
          taskId={selectedTaskId}
          chatId={chatId!}
          memberRole={currentMember?.role}
        />
      )}
    </div>
  )
}

interface MessageBubbleProps {
  message: any
  isOwn: boolean
  chatType?: string
  isGroupAdmin?: boolean
  onConvertToTask?: (message: any) => void
  onOpenTaskDetails?: (taskId: string) => void
  onReply?: (message: any) => void
}

function MessageBubble({ message, isOwn, chatType, isGroupAdmin, onConvertToTask, onOpenTaskDetails, onReply }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false)
  const isTask = message.isTask

  const getStatusColor = (status: TaskStatus) => {
    return TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS.PENDING
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu(true)
  }

  const handleTaskClick = () => {
    if (isTask && message.task?.id) {
      onOpenTaskDetails?.(message.task.id)
    }
  }

  const renderMediaContent = () => {
    switch (message.type) {
      case MessageType.IMAGE:
        return (
          <img
            src={message.fileUrl}
            alt="Image"
            className="max-w-full rounded-lg cursor-pointer"
            onClick={() => window.open(message.fileUrl, '_blank')}
          />
        )
      case MessageType.VIDEO:
        return (
          <video
            src={message.fileUrl}
            controls
            className="max-w-full rounded-lg"
          />
        )
      case MessageType.AUDIO:
        return (
          <audio src={message.fileUrl} controls className="w-full" />
        )
      case MessageType.FILE:
        return (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[#00A884] hover:underline"
          >
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            <span className="text-sm">Download File</span>
          </a>
        )
      default:
        return null
    }
  }

  return (
    <div className={`flex mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          relative max-w-[65%] rounded-lg px-2.5 py-1.5 shadow group
          ${isOwn
            ? 'bg-[#005C4B] rounded-tr-none'
            : 'bg-[#202C33] rounded-tl-none'
          }
          ${isTask ? 'border-l-4 cursor-pointer' : ''}
        `}
        style={isTask && message.task ? { borderLeftColor: getStatusColor(message.task.status) } : {}}
        onContextMenu={handleContextMenu}
        onClick={isTask ? handleTaskClick : undefined}
      >
        {/* Menu button (shown on hover) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="absolute -top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-[#8696A0] hover:text-white transition-opacity"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </button>

        {/* Context menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute top-full right-0 mt-1 w-40 bg-[#233138] rounded-md shadow-lg py-1 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  onReply?.(message)
                }}
                className="w-full px-4 py-2 text-left text-[#E9EDEF] hover:bg-[#3B4A54] text-sm flex items-center gap-2"
              >
                <ReplyIcon />
                Reply
              </button>
              {isGroupAdmin && !isTask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onConvertToTask?.(message)
                  }}
                  className="w-full px-4 py-2 text-left text-[#E9EDEF] hover:bg-[#3B4A54] text-sm flex items-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Convert to Task
                </button>
              )}
            </div>
          </>
        )}

        {/* Reply reference */}
        {message.replyTo && (
          <div className="mb-1 pb-1 border-l-2 border-[#00A884] pl-2 bg-black/10 rounded">
            <p className="text-xs text-[#00A884] font-medium">
              {message.replyTo.sender?.name || 'Unknown'}
            </p>
            <p className="text-xs text-[#8696A0] truncate">
              {message.replyTo.content || (message.replyTo.type !== 'TEXT' ? `[${message.replyTo.type}]` : '')}
            </p>
          </div>
        )}

        {/* Sender name (group chats only) */}
        {!isOwn && chatType === 'GROUP' && (
          <p className="text-xs font-medium text-[#00A884] mb-0.5">
            {message.sender?.name}
          </p>
        )}

        {/* Media content */}
        {message.type !== MessageType.TEXT && renderMediaContent()}

        {/* Message content */}
        {message.content && (
          <p className="text-[#E9EDEF] text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {/* Task indicator */}
        {isTask && message.task && (
          <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-white/10">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStatusColor(message.task.status) }}
            />
            <span className="text-xs text-[#8696A0]">
              Task: {message.task.status.replace('_', ' ')}
            </span>
            <span className="ml-auto text-xs text-[#00A884]">
              View details
            </span>
          </div>
        )}

        {/* Timestamp and read status */}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[11px] text-[#8696A0]">
            {formatMessageTime(message.createdAt)}
          </span>
          {isOwn && <DoubleCheckIcon read={true} />}
        </div>

        {/* Message tail */}
        <div
          className={`absolute top-0 w-3 h-3 ${
            isOwn
              ? '-right-2 bg-[#005C4B]'
              : '-left-2 bg-[#202C33]'
          }`}
          style={{
            clipPath: isOwn
              ? 'polygon(0 0, 100% 0, 0 100%)'
              : 'polygon(100% 0, 0 0, 100% 100%)',
          }}
        />
      </div>
    </div>
  )
}
