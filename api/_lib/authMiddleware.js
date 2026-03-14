/**
 * Authentication Middleware
 * Validates JWT session tokens for protected API routes
 */

import jwt from 'jsonwebtoken'
import cookie from 'cookie'

/**
 * Verify user session from request
 * Returns user object if authenticated, null otherwise
 */
export async function verifySession(req) {
  try {
    const cookies = cookie.parse(req.headers.cookie || '')
    const sessionToken = cookies.session

    if (!sessionToken) {
      return null
    }

    // Verify JWT
    const decoded = jwt.verify(sessionToken, process.env.NEXTAUTH_SECRET)

    // Check auth version
    const currentAuthVersion = process.env.AUTH_VERSION || '1'
    if (decoded.authVersion !== currentAuthVersion) {
      return null
    }

    // Return user info
    return {
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      sub: decoded.sub,
    }
  } catch (error) {
    return null
  }
}

/**
 * Middleware wrapper for protected routes
 * Requires authentication before calling handler
 */
export function withAuth(handler) {
  return async (req, res) => {
    const user = await verifySession(req)

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be signed in to access this resource',
      })
    }

    // Attach user to request for use in handler
    req.user = user

    // Call the original handler
    return handler(req, res)
  }
}
