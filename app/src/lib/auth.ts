export interface AuthUser {
  id: string
  name: string
  email: string
}

export const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('token') : null

export const setToken = (token: string): void =>
  localStorage.setItem('token', token)

export const removeToken = (): void =>
  localStorage.removeItem('token')

export const getUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('user')
  return raw ? (JSON.parse(raw) as AuthUser) : null
}

export const setUser = (user: AuthUser): void =>
  localStorage.setItem('user', JSON.stringify(user))

export const logout = (): void => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}
