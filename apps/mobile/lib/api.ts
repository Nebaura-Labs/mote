import { createClient } from 'orpc'
import Constants from 'expo-constants'
import type { AppRouter } from '@mote/api-client'

const API_URL = __DEV__
  ? 'http://localhost:3000/api/orpc'
  : 'https://mote.nebaura.studio/api/orpc'

export const api = createClient<AppRouter>({
  baseUrl: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth API helpers
export const authApi = {
  login: async (email: string, password: string) => {
    try {
      return await api.auth.login({ email, password })
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },
  signup: async (email: string, password: string, name: string) => {
    try {
      return await api.auth.signup({ email, password, name })
    } catch (error) {
      console.error('Signup error:', error)
      throw error
    }
  },
  logout: async () => {
    try {
      return await api.auth.logout()
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  },
  getMe: async () => {
    try {
      return await api.auth.me()
    } catch (error) {
      console.error('Get me error:', error)
      throw error
    }
  },
}

// Devices API helpers
export const devicesApi = {
  list: async () => {
    try {
      return await api.devices.list()
    } catch (error) {
      console.error('List devices error:', error)
      throw error
    }
  },
  pair: async (name: string, bluetoothId: string) => {
    try {
      return await api.devices.pair({ name, bluetoothId })
    } catch (error) {
      console.error('Pair device error:', error)
      throw error
    }
  },
  unpair: async (deviceId: string) => {
    try {
      return await api.devices.unpair({ deviceId })
    } catch (error) {
      console.error('Unpair device error:', error)
      throw error
    }
  },
  updateStatus: async (deviceId: string, batteryLevel: number, lastSeen: Date) => {
    try {
      return await api.devices.updateStatus({ deviceId, batteryLevel, lastSeen })
    } catch (error) {
      console.error('Update device status error:', error)
      throw error
    }
  },
}

// Voice API helpers
export const voiceApi = {
  startSession: async (deviceId: string) => {
    try {
      return await api.voice.startSession({ deviceId })
    } catch (error) {
      console.error('Start session error:', error)
      throw error
    }
  },
  sendAudio: async (sessionId: string, audioData: string) => {
    try {
      return await api.voice.sendAudio({ sessionId, audioData })
    } catch (error) {
      console.error('Send audio error:', error)
      throw error
    }
  },
  endSession: async (sessionId: string, duration: number) => {
    try {
      return await api.voice.endSession({ sessionId, duration })
    } catch (error) {
      console.error('End session error:', error)
      throw error
    }
  },
}

// Clawd API helpers
export const clawdApi = {
  connect: async (apiKey: string, endpoint: string) => {
    try {
      return await api.clawd.connect({ apiKey, endpoint })
    } catch (error) {
      console.error('Connect to Clawd error:', error)
      throw error
    }
  },
  disconnect: async (connectionId: string) => {
    try {
      return await api.clawd.disconnect({ connectionId })
    } catch (error) {
      console.error('Disconnect from Clawd error:', error)
      throw error
    }
  },
  getStatus: async () => {
    try {
      return await api.clawd.status()
    } catch (error) {
      console.error('Get Clawd status error:', error)
      throw error
    }
  },
}
