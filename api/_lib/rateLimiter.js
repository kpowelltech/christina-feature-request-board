/**
 * Simple in-memory rate limiter for Vercel Serverless Functions
 *
 * Note: This uses in-memory storage which is reset on each cold start.
 * For production, consider using Vercel Edge Config, Upstash Redis, or similar.
 *
 * This provides basic protection against abuse during a single function execution window.
 */

const requestCounts = new Map()

/**
 * Clean up old entries (older than windowMs)
 */
function cleanupOldEntries(windowMs) {
  const now = Date.now()
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.firstRequest > windowMs) {
      requestCounts.delete(key)
    }
  }
}

/**
 * Rate limiter middleware for serverless functions
 *
 * @param {number} maxRequests - Maximum number of requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<{allowed: boolean, retryAfter?: number}>}
 */
export async function checkRateLimit(identifier, maxRequests = 10, windowMs = 15 * 60 * 1000) {
  // Clean up old entries periodically
  cleanupOldEntries(windowMs)

  const now = Date.now()
  const requestData = requestCounts.get(identifier)

  if (!requestData) {
    // First request from this identifier
    requestCounts.set(identifier, {
      count: 1,
      firstRequest: now,
    })
    return { allowed: true }
  }

  const timePassed = now - requestData.firstRequest

  if (timePassed > windowMs) {
    // Window has passed, reset counter
    requestCounts.set(identifier, {
      count: 1,
      firstRequest: now,
    })
    return { allowed: true }
  }

  if (requestData.count >= maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((windowMs - timePassed) / 1000) // seconds
    return { allowed: false, retryAfter }
  }

  // Increment counter
  requestData.count++
  return { allowed: true }
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(req) {
  // Try multiple headers to get the real IP
  const forwarded = req.headers['x-forwarded-for']
  const realIp = req.headers['x-real-ip']
  const cfConnectingIp = req.headers['cf-connecting-ip'] // Cloudflare

  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp
  }

  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Fallback to connection IP
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Wrapper to apply rate limiting to a serverless handler
 *
 * @param {Function} handler - The serverless function handler
 * @param {Object} options - Rate limiting options
 * @param {number} options.maxRequests - Max requests per window
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Function} Wrapped handler with rate limiting
 */
export function withRateLimit(handler, options = {}) {
  const maxRequests = options.maxRequests || 10
  const windowMs = options.windowMs || 15 * 60 * 1000

  return async (req, res) => {
    const identifier = getClientIdentifier(req)

    const { allowed, retryAfter } = await checkRateLimit(
      identifier,
      maxRequests,
      windowMs
    )

    if (!allowed) {
      console.warn(`🚫 Rate limit exceeded for IP: ${identifier}`)

      // Dynamically import audit logger to avoid circular dependencies
      try {
        const { logRateLimitExceeded } = await import('./auditLogger.js')
        logRateLimitExceeded(req.url || req.path || 'unknown', req)
      } catch (error) {
        // Ignore if audit logger is not available
      }

      res.setHeader('Retry-After', retryAfter)
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', 0)
      res.setHeader('X-RateLimit-Reset', Date.now() + (retryAfter * 1000))

      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: `${retryAfter} seconds`,
      })
    }

    // Add rate limit headers for successful requests
    const requestData = requestCounts.get(identifier)
    if (requestData) {
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requestData.count))
    }

    // Call the original handler
    return handler(req, res)
  }
}
