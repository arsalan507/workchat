import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import { formatMessageDate, formatMessageTime } from '@workchat/shared'

export default function HomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  // Fetch chats
  const { data: chatsData, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const response = await api.get('/api/chats')
      return response.data.data
    },
  })

  const chats = chatsData || []

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-whatsapp-green-dark text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">WorkChat</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-90">{user?.name}</span>
          <button
            onClick={logout}
            className="text-sm opacity-75 hover:opacity-100"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Search bar */}
      <div className="px-4 py-2 bg-white border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Search or start new chat"
            className="w-full bg-gray-100 rounded-lg px-10 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-whatsapp-green"
          />
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-whatsapp-green border-t-transparent rounded-full" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <svg className="w-16 h-16 mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
            </svg>
            <p>No chats yet</p>
          </div>
        ) : (
          chats.map((chat: any) => (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
            >
              {/* Avatar */}
              <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-white font-medium text-lg">
                {chat.name.charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 truncate">
                    {chat.name}
                  </h3>
                  {chat.lastMessage && (
                    <span className="text-xs text-gray-500">
                      {formatMessageTime(chat.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm text-gray-500 truncate">
                    {chat.lastMessage?.content || 'No messages yet'}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="bg-whatsapp-green text-white text-xs px-2 py-0.5 rounded-full">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
