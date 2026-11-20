import { createContext } from 'react'

export interface Director {
  id: string | number
  name: string
  email: string
  role: string
}

export interface AuthContextValue {
  director: Director | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
