import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, ChatMessage } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null })
      },
    }),
    { name: 'auth-store' }
  )
)

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  addMessage: (msg: ChatMessage) => void
  setLoading: (v: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, { ...msg, timestamp: new Date().toISOString() }],
    })),
  setLoading: (v) => set({ isLoading: v }),
  clearMessages: () => set({ messages: [] }),
}))
