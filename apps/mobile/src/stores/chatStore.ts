import { create } from 'zustand'

interface ChatState {
  currentChatId: string | null
  setCurrentChatId: (chatId: string | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  currentChatId: null,
  setCurrentChatId: (chatId) => set({ currentChatId: chatId }),
}))
