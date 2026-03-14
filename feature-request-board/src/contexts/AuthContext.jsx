import {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    // Check for existing session on mount
    checkSession()

    // Set up periodic session validation (every 5 minutes)
    const validationInterval = setInterval(() => {
      if (status === 'authenticated') {
        checkSession()
      }
    }, 5 * 60 * 1000) // 5 minutes

    // Set up auto-refresh before token expiry (refresh every 6 days for 7-day token)
    const refreshInterval = setInterval(() => {
      if (status === 'authenticated') {
        refreshSession()
      }
    }, 6 * 24 * 60 * 60 * 1000) // 6 days

    return () => {
      clearInterval(validationInterval)
      clearInterval(refreshInterval)
    }
  }, [status])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth-session', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setStatus('authenticated')
      } else {
        setUser(null)
        setStatus('unauthenticated')
      }
    } catch (error) {
      console.error('Failed to check session:', error)
      setUser(null)
      setStatus('unauthenticated')
    }
  }

  const refreshSession = async () => {
    try {
      console.log('🔄 Refreshing session...')
      const response = await fetch('/api/auth-refresh', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Refresh failed')
      }

      console.log('✅ Session refreshed successfully')
      // Re-check session to get updated user data
      await checkSession()
      return true
    } catch (error) {
      console.error('❌ Failed to refresh session:', error)
      setUser(null)
      setStatus('unauthenticated')
      return false
    }
  }

  const signOut = async () => {
    try {
      await fetch('/api/auth-signout', {
        method: 'POST',
        credentials: 'include',
      })
      setUser(null)
      setStatus('unauthenticated')
      window.location.href = '/signin'
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, status, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
