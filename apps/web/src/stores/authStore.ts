import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@workchat/shared'
import { api } from '../services/api'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null

  // OTP state
  otpPhone: string | null
  otpExpiresIn: number | null
  isNewUser: boolean

  // Actions
  requestOtp: (phone: string) => Promise<void>
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ isNewUser: boolean }>
  logout: () => void
  refreshAccessToken: () => Promise<void>
  setUser: (user: User) => void
  clearOtpState: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      otpPhone: null,
      otpExpiresIn: null,
      isNewUser: false,

      requestOtp: async (phone: string) => {
        const response = await api.post('/api/auth/request-otp', { phone })
        const { expiresIn } = response.data.data

        set({
          otpPhone: phone,
          otpExpiresIn: expiresIn,
        })
      },

      verifyOtp: async (phone: string, otp: string, name?: string) => {
        const response = await api.post('/api/auth/verify-otp', { phone, otp, name })
        const { user, accessToken, refreshToken, isNewUser } = response.data.data

        set({
          user,
          token: accessToken,
          refreshToken,
          isNewUser,
          otpPhone: null,
          otpExpiresIn: null,
        })

        return { isNewUser }
      },

      logout: () => {
        api.post('/api/auth/logout').catch(() => {})
        set({
          user: null,
          token: null,
          refreshToken: null,
          otpPhone: null,
          otpExpiresIn: null,
          isNewUser: false,
        })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        const response = await api.post('/api/auth/refresh', { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = response.data.data

        set({
          token: accessToken,
          refreshToken: newRefreshToken,
        })
      },

      setUser: (user: User) => {
        set({ user })
      },

      clearOtpState: () => {
        set({
          otpPhone: null,
          otpExpiresIn: null,
        })
      },
    }),
    {
      name: 'workchat-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

// No more global admin check - permissions are per-chat
// This hook can be removed from components that use it
export const useIsAdmin = () => {
  // Always return false since there's no global admin
  // Group admin status should be checked per-chat
  return false
}
