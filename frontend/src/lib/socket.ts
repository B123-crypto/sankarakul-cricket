import { io } from 'socket.io-client'
import { apiBaseUrl } from './api'

export function createMatchSocket() {
  return io(apiBaseUrl, {
    autoConnect: false,
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  })
}
