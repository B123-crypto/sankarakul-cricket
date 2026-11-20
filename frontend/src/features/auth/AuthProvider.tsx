import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext } from './authContext'
import type { Director } from './authContext'
import { apiClient, setAuthToken } from '../../lib/api'

interface LoginResponse {
  success: boolean
  token: string
  data: Director
  message?: string
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [director, setDirector] = useState<Director | null>(null)
  const queryClient = useQueryClient()

  const logout = useCallback(() => {
    setAuthToken(null)
    setDirector(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    const handleExpiredSession = () => logout()
    window.addEventListener('director:session-expired', handleExpiredSession)
    return () => window.removeEventListener('director:session-expired', handleExpiredSession)
  }, [logout])

  const value = useMemo(() => ({
    director,
    logout,
    async login(email: string, password: string) {
      const response = await apiClient.post<LoginResponse>('/admin/login', {
        email,
        password,
      })
      if (!response.data.success || !response.data.token || !response.data.data) {
        throw new Error(response.data.message || 'The server returned an invalid login response.')
      }

      setAuthToken(response.data.token)
      try {
        await apiClient.get('/admin/dashboard')
        setDirector(response.data.data)
      } catch (error) {
        setAuthToken(null)
        throw error
      }
    },
  }), [director, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
