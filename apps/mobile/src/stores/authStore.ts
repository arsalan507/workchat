import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../services/api'

interface User {
  id: string
  phone: string
  name: string
  avatarUrl: string | null
  isVerified: boolean
  createdAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  isInitialized: boolean

  // OTP state
  otpPhone: string | null
  otpExpiresIn: number | null

  // Actions
  initialize: () => Promise<void>
  requestOtp: (phone: string) => Promise<{ devMode?: boolean }>
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ isNewUser: boolean }>
  logout: () => Promise<void>
  setUser: (user: User) => void
  clearOtpState: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  isInitialized: false,

  otpPhone: null,
  otpExpiresIn: null,

  initialize: async () => {
    try {
      const [token, refreshToken, userJson] = await AsyncStorage.multiGet([
        'workchat-token',
        'workchat-refresh-token',
        'workchat-user',
      ])

      const storedToken = token[1]
      const storedRefreshToken = refreshToken[1]
      const storedUser = userJson[1] ? JSON.parse(userJson[1]) : null

      set({
        token: storedToken,
        refreshToken: storedRefreshToken,
        user: storedUser,
        isInitialized: true,
      })

      // Verify token is still valid
      if (storedToken) {
        try {
          const response = await api.get('/api/auth/me')
          set({ user: response.data.data })
          await AsyncStorage.setItem('workchat-user', JSON.stringify(response.data.data))
        } catch (error) {
          // Token invalid - clear auth state
          await AsyncStorage.multiRemove(['workchat-token', 'workchat-refresh-token', 'workchat-user'])
          set({ token: null, refreshToken: null, user: null })
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error)
      set({ isInitialized: true })
    }
  },

  requestOtp: async (phone: string) => {
    set({ isLoading: true })
    try {
      const response = await api.post('/api/auth/request-otp', { phone })
      const { expiresIn, devMode } = response.data.data

      set({
        otpPhone: phone,
        otpExpiresIn: expiresIn,
        isLoading: false,
      })

      return { devMode }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  verifyOtp: async (phone: string, otp: string, name?: string) => {
    set({ isLoading: true })
    try {
      const response = await api.post('/api/auth/verify-otp', { phone, otp, name })
      const { user, accessToken, refreshToken, isNewUser } = response.data.data

      // Store tokens and user
      await AsyncStorage.setItem('workchat-token', accessToken)
      await AsyncStorage.setItem('workchat-refresh-token', refreshToken)
      await AsyncStorage.setItem('workchat-user', JSON.stringify(user))

      set({
        user,
        token: accessToken,
        refreshToken,
        otpPhone: null,
        otpExpiresIn: null,
        isLoading: false,
      })

      return { isNewUser }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      // Ignore errors - we're logging out anyway
    }

    await AsyncStorage.multiRemove(['workchat-token', 'workchat-refresh-token', 'workchat-user'])

    set({
      user: null,
      token: null,
      refreshToken: null,
      otpPhone: null,
      otpExpiresIn: null,
    })
  },

  setUser: (user: User) => {
    set({ user })
    AsyncStorage.setItem('workchat-user', JSON.stringify(user))
  },

  clearOtpState: () => {
    set({
      otpPhone: null,
      otpExpiresIn: null,
    })
  },
}))
