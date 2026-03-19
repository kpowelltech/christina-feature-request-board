import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function SignIn() {
  const { status } = useAuth()
  const [errorMessage, setErrorMessage] = useState('')

  // Check URL for error parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')

    if (error) {
      const errorMessages = {
        oauth_failed: 'OAuth authentication failed. Please try again.',
        no_code: 'No authorization code received. Please try again.',
        email_not_verified: 'Your email is not verified with Google. Please verify your email and try again.',
        invalid_domain: 'Access denied. Only @tapcart.co email addresses are allowed.',
        callback_failed: 'Authentication callback failed. Please try again.',
      }

      setErrorMessage(errorMessages[error] || 'An unknown error occurred. Please try again.')
    }
  }, [])

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      window.location.href = '/'
    }
  }, [status])

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth-google'
  }

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
      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: '40px',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '12px',
            fontFamily: "'Syne', sans-serif",
          }}>
            Feature Request Board
          </h1>
        </div>

        {errorMessage && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            backgroundColor: '#3d1616',
            border: '1px solid #8b2929',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#fca5a5',
          }}>
            {errorMessage}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 24px',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#fff',
            backgroundColor: '#1a1a1a',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#252525'
            e.currentTarget.style.borderColor = '#444'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1a1a'
            e.currentTarget.style.borderColor = '#333'
          }}
        >
          <svg
            style={{ width: '20px', height: '20px', marginRight: '12px' }}
            viewBox="0 0 24 24"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
