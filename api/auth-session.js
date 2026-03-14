/**
 * Vercel Serverless Function: /api/auth-session
 * Returns current user session
 */

import jwt from 'jsonwebtoken'
import cookie from 'cookie'

export default async function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '')
  const sessionToken = cookies.session

  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const decoded = jwt.verify(sessionToken, process.env.NEXTAUTH_SECRET)

    // Check authentication version (force re-auth if version changed)
    const currentAuthVersion = process.env.AUTH_VERSION || '1'
    if (decoded.authVersion !== currentAuthVersion) {
      console.warn(`🚫 Outdated auth version: ${decoded.authVersion} (current: ${currentAuthVersion})`)
      return res.status(401).json({ error: 'Session expired - please sign in again' })
    }

    // Return user session
    return res.status(200).json({
      user: {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      },
    })
  } catch (error) {
    console.error('❌ Invalid session token:', error.message)
    return res.status(401).json({ error: 'Invalid session' })
  }
}
