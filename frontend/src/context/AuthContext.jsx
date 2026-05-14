import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser, logout as apiLogout } from '../api'
import { LoginModal } from '../components/LoginModal/LoginModal'

const AuthContext = createContext({
  user: null,
  isLoading: true,
  logout: async () => {},
  openLogin: () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    getCurrentUser()
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  async function logout() {
    await apiLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, openLogin: () => setLoginOpen(true) }}>
      {children}
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
