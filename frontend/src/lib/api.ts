import axios from 'axios'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const apiBaseUrl = (
  configuredBaseUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')
).replace(/\/+$/, '')

export const apiClient = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  timeout: 12_000,
  headers: { Accept: 'application/json' },
})

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

apiClient.interceptors.request.use((config) => {
  if (authToken) config.headers.set('Authorization', `Bearer ${authToken}`)
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      authToken &&
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403)
    ) {
      window.dispatchEvent(new Event('director:session-expired'))
    }
    return Promise.reject(error)
  },
)

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export async function postApiData<T>(path: string, body: unknown): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(path, body)
  if (!response.data.success) {
    throw new Error(
      response.data.message || 'The server could not complete the request.',
    )
  }
  return response.data.data
}

export async function patchApiData<T>(path: string, body: unknown): Promise<T> {
  const response = await apiClient.patch<ApiResponse<T>>(path, body)
  if (!response.data.success) {
    throw new Error(
      response.data.message || 'The server could not complete the request.',
    )
  }
  return response.data.data
}

export async function deleteApiData<T>(path: string): Promise<T> {
  const response = await apiClient.delete<ApiResponse<T>>(path)
  if (!response.data.success) {
    throw new Error(
      response.data.message || 'The server could not complete the request.',
    )
  }
  return response.data.data
}

export async function getApiData<T>(path: string): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(path)
  if (!response.data.success) {
    throw new Error(
      response.data.message || 'The server could not complete the request.',
    )
  }
  return response.data.data
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.data?.message) return error.response.data.message
    if (error.code === 'ECONNABORTED') {
      return 'The server took too long to respond. Check your connection and try again.'
    }
    if (error.response) {
      return `The server returned an error (${error.response.status}). Please try again.`
    }
    const server = apiBaseUrl || 'this site'
    return `Cannot reach the score server at ${server}. Check that the backend is running and the API URL is correct.`
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}
