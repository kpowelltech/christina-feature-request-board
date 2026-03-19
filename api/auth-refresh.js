/**
 * Vercel Serverless Function: /api/auth-refresh
 * Refreshes the user's session token with sliding window expiration
 *
 * Security features:
 * - Validates existing session before refresh
 * - Implements sliding window expiration (extends on activity)
 * - Rate limited to prevent abuse
 * - HTTP-only secure cookie
 * - Audit logging
 */

import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { withRateLimit } from './_lib/rateLimiter.js'
import { logSessionRefresh, logSessionInvalid } from './_lib/auditLogger.js'

async function handler(req, res) {
  // SECURITY: Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are allowed',
    })
  }

  try {
    // Parse cookies from request
    const cookies = cookie.parse(req.headers.cookie || '')
    const sessionToken = cookies.session

    if (!sessionToken) {
      console.warn('🚫 Token refresh attempted without session')
      logSessionInvalid('No session token present', req)
      return res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'No active session found',
      })
    }

    // Verify the existing token
    let decoded
    try {
      decoded = jwt.verify(sessionToken, process.env.NEXTAUTH_SECRET)
    } catch (error) {
      console.warn(`🚫 Invalid session token during refresh: ${error.message}`)
      logSessionInvalid(`Token verification failed: ${error.message}`, req)

      // Clear the invalid cookie
      res.setHeader(
        'Set-Cookie',
        'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
      )

      return res.status(401).json({
        error: 'AUTH_TOKEN_EXPIRED',
        message: 'Session expired. Please sign in again.',
      })
    }

    // SECURITY CHECK: Verify auth version
    const currentAuthVersion = process.env.AUTH_VERSION || '1'
    if (decoded.authVersion !== currentAuthVersion) {
      console.warn(`🚫 Outdated auth version during refresh: ${decoded.authVersion} (current: ${currentAuthVersion})`)
      logSessionInvalid(`Outdated auth version: ${decoded.authVersion}`, req)

      // Clear the invalid cookie
      res.setHeader(
        'Set-Cookie',
        'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
      )

      return res.status(401).json({
        error: 'AUTH_VERSION_MISMATCH',
        message: 'Session expired. Please sign in again.',
      })
    }

    // SECURITY CHECK: Verify email domain (defense-in-depth)
    if (!decoded.email || !decoded.email.endsWith('@tapcart.co')) {
      console.warn(`🚫 Invalid domain during refresh: ${decoded.email}`)
      logSessionInvalid(`Invalid domain: ${decoded.email}`, req)
      return res.status(403).json({
        error: 'AUTH_INVALID_DOMAIN',
        message: 'Invalid domain',
      })
    }

    // SLIDING WINDOW: Issue new token (expires when browser closes)
    const newToken = jwt.sign(
      {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        sub: decoded.sub,
        authVersion: currentAuthVersion, // Include current auth version
        refreshedAt: new Date().toISOString(),
      },
      process.env.NEXTAUTH_SECRET,
      {
        expiresIn: '24h', // 24 hours max, but cookie expires when browser closes
      }
    )

    // Set new HTTP-only session cookie (no Max-Age = expires when browser closes)
    res.setHeader(
      'Set-Cookie',
      `session=${newToken}; Path=/; HttpOnly; Secure; SameSite=Lax`
    )

    // SECURITY: Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

    console.log(`✅ Session refreshed for: ${decoded.email}`)
    logSessionRefresh(decoded.email, req)

    return res.status(200).json({
      success: true,
      message: 'Session refreshed successfully',
      expiresIn: '24h',
    })
  } catch (error) {
    console.error('❌ Token refresh error:', error)

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh session. Please try again.',
    })
  }
}

// Export with strict rate limiting (5 requests per 15 minutes per IP)
export default withRateLimit(handler, { maxRequests: 5, windowMs: 15 * 60 * 1000 })
