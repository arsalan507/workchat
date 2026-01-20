import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, UserRole } from '@workchat/shared'
import { api } from '../services/api'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null

  // Actions
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,

      login: async (phone: string, password: string) => {
        const response = await api.post('/api/auth/login', { phone, password })
        const { user, accessToken, refreshToken } = response.data.data

        set({
          user,
          token: accessToken,
          refreshToken,
        })
      },

      logout: () => {
        api.post('/api/auth/logout').catch(() => {})
        set({
          user: null,
          token: null,
          refreshToken: null,
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

// Helper to check if user is admin
export const useIsAdmin = () => {
  const user = useAuthStore((state) => state.user)
  return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
}
