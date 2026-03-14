/**
 * Vercel Serverless Function: /api/auth-google
 * Initiates Google OAuth flow
 */

import { withRateLimit } from './_lib/rateLimiter.js'

async function handler(req, res) {
  console.log('🔐 Initiating Google OAuth flow...')

  // Validate required environment variables
  if (!process.env.NEXTAUTH_URL) {
    console.error('❌ NEXTAUTH_URL is not set')
    return res.status(500).json({
      error: 'Configuration error',
      message: 'NEXTAUTH_URL environment variable is not configured',
    })
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    console.error('❌ GOOGLE_CLIENT_ID is not set')
    return res.status(500).json({
      error: 'Configuration error',
      message: 'GOOGLE_CLIENT_ID environment variable is not configured',
    })
  }

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  // Remove trailing slash from NEXTAUTH_URL if present
  const baseUrl = process.env.NEXTAUTH_URL.replace(/\/$/, '')

  const params = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${baseUrl}/api/auth-callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    hd: 'tapcart.co', // Restrict to tapcart.co domain
  }

  Object.entries(params).forEach(([key, value]) => {
    googleAuthUrl.searchParams.append(key, value)
  })

  const redirectUrl = googleAuthUrl.toString()
  console.log('🔗 Redirecting to:', redirectUrl)

  res.writeHead(302, { Location: redirectUrl })
  res.end()
}

// Export with rate limiting (10 requests per 15 minutes per IP)
export default withRateLimit(handler, { maxRequests: 10, windowMs: 15 * 60 * 1000 })
