/**
 * Vercel Serverless Function: /api/auth-callback
 * Handles Google OAuth callback
 */

import jwt from 'jsonwebtoken'
import { withRateLimit } from './_lib/rateLimiter.js'
import { logAuthSuccess, logAuthFailure, logInvalidDomain } from './_lib/auditLogger.js'

async function handler(req, res) {
  console.log('🔄 Handling OAuth callback...')
  const { code, error } = req.query

  if (error) {
    console.error('❌ OAuth error:', error)
    logAuthFailure(`OAuth error: ${error}`, null, req)
    res.writeHead(302, { Location: '/signin?error=oauth_failed' })
    return res.end()
  }

  if (!code) {
    res.writeHead(302, { Location: '/signin?error=no_code' })
    return res.end()
  }

  try {
    // Remove trailing slash from NEXTAUTH_URL if present
    const baseUrl = process.env.NEXTAUTH_URL.replace(/\/$/, '')

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${baseUrl}/api/auth-callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()

    // Get user info
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    )

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info')
    }

    const userInfo = await userInfoResponse.json()

    // SECURITY CHECK 1: Verify email is verified by Google
    if (!userInfo.verified_email) {
      console.warn(`🚫 Unverified email attempted access: ${userInfo.email}`)
      logAuthFailure('Email not verified by Google', userInfo.email, req)
      res.writeHead(302, { Location: '/signin?error=email_not_verified' })
      return res.end()
    }

    // SECURITY CHECK 2: Verify hosted domain matches (Google Workspace verification)
    if (userInfo.hd !== 'tapcart.co') {
      console.warn(
        `🚫 Invalid hosted domain: ${userInfo.hd || 'none'} for ${userInfo.email}`
      )
      logInvalidDomain(userInfo.email, userInfo.hd || 'none', req)
      res.writeHead(302, { Location: '/signin?error=invalid_domain' })
      return res.end()
    }

    // SECURITY CHECK 3: Verify email domain (defense-in-depth)
    if (!userInfo.email || !userInfo.email.endsWith('@tapcart.co')) {
      console.warn(`🚫 Access denied for ${userInfo.email}`)
      logInvalidDomain(userInfo.email, userInfo.email?.split('@')[1] || 'none', req)
      res.writeHead(302, { Location: '/signin?error=invalid_domain' })
      return res.end()
    }

    // Create JWT session token (expires when browser closes)
    const sessionToken = jwt.sign(
      {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        sub: userInfo.id,
        authVersion: process.env.AUTH_VERSION || '1', // Auth version for invalidation
      },
      process.env.NEXTAUTH_SECRET,
      {
        expiresIn: '24h', // 24 hours max, but cookie expires when browser closes
      }
    )

    // Set HTTP-only session cookie (no Max-Age = expires when browser closes)
    res.writeHead(302, {
      'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      Location: '/',
    })

    console.log(`✅ User signed in: ${userInfo.email}`)
    logAuthSuccess(userInfo.email, req, userInfo)
    res.end()
  } catch (error) {
    console.error('❌ OAuth callback error:', error)
    logAuthFailure(`OAuth callback error: ${error.message}`, null, req)
    res.writeHead(302, { Location: '/signin?error=callback_failed' })
    res.end()
  }
}

// Export with rate limiting (10 requests per 15 minutes per IP)
export default withRateLimit(handler, { maxRequests: 10, windowMs: 15 * 60 * 1000 })
