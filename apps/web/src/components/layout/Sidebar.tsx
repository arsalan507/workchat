import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../services/api'
import { getSocket } from '../../services/socket'
import { formatMessageTime } from '@workchat/shared'
import { ActiveTab } from '../../pages/MainLayout'
import NewChatModal from '../contacts/NewChatModal'

// Icons
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/>
  </svg>
)

const TaskIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
  </svg>
)

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
  </svg>
)

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/>
  </svg>
)

const NewChatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/>
  </svg>
)

type FilterType = 'all' | 'unread' | 'favourites' | 'groups'

interface SidebarProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const navigate = useNavigate()
  const { chatId } = useParams<{ chatId: string }>()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [showMenu, setShowMenu] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)

  // Fetch chats
  const { data: chatsData, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const response = await api.get('/api/chats')
      return response.data.data
    },
  })

  // Socket.io listeners for chat list updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    // Listen for new messages to update chat list order/preview
    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    }

    // Listen for new chat created
    const handleChatCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    }

    // Listen for chat updates
    const handleChatUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    }

    socket.on('new_message', handleNewMessage)
    socket.on('chat_created', handleChatCreated)
    socket.on('chat_updated', handleChatUpdated)

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('chat_created', handleChatCreated)
      socket.off('chat_updated', handleChatUpdated)
    }
  }, [queryClient])

  const chats = chatsData || []

  // Filter chats based on search and filter type
  const filteredChats = chats.filter((chat: any) => {
    // Search filter
    if (searchQuery && !chat.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    // Type filter
    if (activeFilter === 'groups' && chat.type !== 'GROUP') {
      return false
    }
    if (activeFilter === 'unread' && chat.unreadCount === 0) {
      return false
    }
    return true
  })

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'favourites', label: 'Favourites' },
    { id: 'groups', label: 'Groups' },
  ]

  return (
    <div className="w-[400px] flex flex-col bg-[#111B21] border-r border-[#222D34]">
      {/* Header */}
      <div className="h-[60px] px-4 flex items-center justify-between bg-[#202C33]">
        {/* User avatar */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#6B7C85] flex items-center justify-center text-white font-medium cursor-pointer">
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange('chats')}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'chats'
                ? 'text-[#00A884] bg-[#00A884]/10'
                : 'text-[#AEBAC1] hover:bg-[#202C33]'
            }`}
            title="Chats"
          >
            <ChatIcon />
          </button>
          <button
            onClick={() => onTabChange('tasks')}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'tasks'
                ? 'text-[#00A884] bg-[#00A884]/10'
                : 'text-[#AEBAC1] hover:bg-[#202C33]'
            }`}
            title="Tasks"
          >
            <TaskIcon />
          </button>
        </div>

        {/* Header icons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 text-[#AEBAC1] hover:text-white transition-colors"
            title="New chat"
          >
            <NewChatIcon />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-[#AEBAC1] hover:text-white transition-colors"
            >
              <MenuIcon />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#233138] rounded-md shadow-lg py-2 z-20">
                  <div className="px-4 py-2 border-b border-[#3B4A54]">
                    <p className="text-white text-sm font-medium">{user?.name}</p>
                    <p className="text-[#8696A0] text-xs">{user?.phone}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      logout()
                    }}
                    className="w-full px-4 py-2 text-left text-[#E9EDEF] hover:bg-[#3B4A54] text-sm"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="px-3 py-2 bg-[#111B21]">
        {/* Search bar */}
        <div className="flex items-center gap-3 bg-[#202C33] rounded-lg px-3 py-2">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#E9EDEF] placeholder-[#8696A0] outline-none text-sm"
          />
          <button className="text-[#8696A0] hover:text-white">
            <FilterIcon />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeFilter === filter.id
                  ? 'bg-[#00A884] text-[#111B21]'
                  : 'bg-[#202C33] text-[#E9EDEF] hover:bg-[#2A3942]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#00A884] border-t-transparent rounded-full" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#8696A0] px-8 text-center">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
            </svg>
            <p className="text-sm">
              {searchQuery ? 'No chats found' : 'No chats yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-3 px-4 py-2 bg-[#00A884] text-white rounded-lg text-sm hover:bg-[#00A884]/90 transition-colors"
              >
                Start a new chat
              </button>
            )}
          </div>
        ) : (
          filteredChats.map((chat: any) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              currentUserId={user?.id}
              isActive={chat.id === chatId}
              onClick={() => navigate(`/chat/${chat.id}`)}
            />
          ))
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
      />
    </div>
  )
}

interface ChatListItemProps {
  chat: any
  currentUserId: string | undefined
  isActive: boolean
  onClick: () => void
}

function ChatListItem({ chat, currentUserId, isActive, onClick }: ChatListItemProps) {
  // For direct chats, show the other user's name instead of chat name
  const getDisplayInfo = () => {
    if (chat.type === 'DIRECT' && chat.members && currentUserId) {
      const otherMember = chat.members.find((m: any) => m.userId !== currentUserId)
      if (otherMember?.user) {
        return {
          name: otherMember.user.name,
          avatarUrl: otherMember.user.avatarUrl,
        }
      }
    }
    return {
      name: chat.name,
      avatarUrl: null,
    }
  }

  const displayInfo = getDisplayInfo()

  const getMessagePreview = () => {
    if (!chat.lastMessage) return 'No messages yet'

    const content = chat.lastMessage.content
    if (chat.lastMessage.type !== 'TEXT') {
      const typeLabels: Record<string, string> = {
        AUDIO: '🎵 Voice message',
        IMAGE: '📷 Photo',
        VIDEO: '🎬 Video',
        FILE: '📎 Document',
      }
      return typeLabels[chat.lastMessage.type] || content
    }
    return content
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${
        isActive ? 'bg-[#2A3942]' : 'hover:bg-[#202C33]'
      }`}
    >
      {/* Avatar */}
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-[#6B7C85] flex items-center justify-center text-white font-medium text-lg overflow-hidden">
          {displayInfo.avatarUrl ? (
            <img
              src={displayInfo.avatarUrl}
              alt={displayInfo.name}
              className="w-full h-full object-cover"
            />
          ) : (
            displayInfo.name?.charAt(0).toUpperCase() || '?'
          )}
        </div>
        {chat.type === 'GROUP' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#00A884] rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 border-b border-[#222D34] pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-[#E9EDEF] truncate">
            {displayInfo.name}
          </h3>
          {chat.lastMessage && (
            <span className={`text-xs ${chat.unreadCount > 0 ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
              {formatMessageTime(chat.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm text-[#8696A0] truncate">
            {getMessagePreview()}
          </p>
          {chat.unreadCount > 0 && (
            <span className="bg-[#00A884] text-[#111B21] text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
