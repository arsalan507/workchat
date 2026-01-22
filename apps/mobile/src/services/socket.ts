import { io, Socket } from 'socket.io-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000'

class SocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  async connect() {
    if (this.socket?.connected) {
      console.log('[Socket] Already connected')
      return
    }

    const token = await AsyncStorage.getItem('workchat-token')
    if (!token) {
      console.log('[Socket] No token, skipping connection')
      return
    }

    console.log('[Socket] Connecting to:', API_URL)

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.log('[Socket] Connection error:', error.message)
    })

    // Set up event forwarding
    this.socket.on('new_message', (data) => {
      console.log('[Socket] New message received:', data.message?.id)
      this.emit('new_message', data)
    })

    this.socket.on('message_converted_to_task', (data) => {
      console.log('[Socket] Message converted to task:', data.messageId)
      this.emit('message_converted_to_task', data)
    })

    this.socket.on('chat_created', (data) => {
      console.log('[Socket] Chat created:', data.chat?.id)
      this.emit('chat_created', data)
    })

    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data)
    })

    this.socket.on('user_online', (data) => {
      this.emit('user_online', data)
    })

    this.socket.on('user_offline', (data) => {
      this.emit('user_offline', data)
    })
  }

  disconnect() {
    if (this.socket) {
      console.log('[Socket] Disconnecting')
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinChat(chatId: string) {
    if (this.socket?.connected) {
      console.log('[Socket] Joining chat:', chatId)
      this.socket.emit('join_chat', { chatId })
    }
  }

  leaveChat(chatId: string) {
    if (this.socket?.connected) {
      console.log('[Socket] Leaving chat:', chatId)
      this.socket.emit('leave_chat', { chatId })
    }
  }

  sendTyping(chatId: string, isTyping: boolean) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { chatId, isTyping })
    }
  }

  // Event subscription system
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data)
      } catch (error) {
        console.error('[Socket] Error in listener:', error)
      }
    })
  }

  isConnected() {
    return this.socket?.connected || false
  }
}

export const socketService = new SocketService()
