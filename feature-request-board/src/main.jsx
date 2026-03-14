import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SignIn from './pages/SignIn.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'

// Simple router component
function Router() {
  const { status } = useAuth()
  const path = window.location.pathname

  // Show SignIn page on /signin route
  if (path === '/signin') {
    return <SignIn />
  }

  // Protected routes - require authentication
  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#fff',
        fontFamily: "'DM Mono', monospace",
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    // Redirect to sign in
    window.location.href = '/signin'
    return null
  }

  // Authenticated - show main app
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Router />
    </AuthProvider>
  </StrictMode>,
)
