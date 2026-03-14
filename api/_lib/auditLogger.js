/**
 * Audit Logger for Authentication Events
 *
 * Logs security-relevant events with structured data for monitoring and forensics.
 *
 * In production, these logs should be:
 * - Sent to a centralized logging service (e.g., Datadog, Logtail, Sentry)
 * - Stored for compliance requirements
 * - Monitored for suspicious patterns
 *
 * For now, logs to console with structured format for Vercel logging.
 */

/**
 * Log levels for audit events
 */
export const AuditLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY',
}

/**
 * Event types for audit logging
 */
export const AuditEvent = {
  // Authentication events
  AUTH_INITIATED: 'AUTH_INITIATED',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILURE: 'AUTH_FAILURE',
  AUTH_INVALID_DOMAIN: 'AUTH_INVALID_DOMAIN',
  AUTH_UNVERIFIED_EMAIL: 'AUTH_UNVERIFIED_EMAIL',

  // Session events
  SESSION_REFRESH: 'SESSION_REFRESH',
  SESSION_REFRESH_FAILED: 'SESSION_REFRESH_FAILED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',

  // Signout events
  SIGNOUT_SUCCESS: 'SIGNOUT_SUCCESS',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Suspicious activity
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
}

/**
 * Get client metadata from request
 */
function getClientMetadata(req) {
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown'

  return {
    ip,
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString(),
  }
}

/**
 * Log an audit event
 *
 * @param {string} level - Log level (AuditLevel)
 * @param {string} event - Event type (AuditEvent)
 * @param {Object} data - Additional event data
 * @param {Object} req - Express/Vercel request object
 */
export function logAuditEvent(level, event, data = {}, req = null) {
  const logEntry = {
    level,
    event,
    ...data,
  }

  // Add client metadata if request is provided
  if (req) {
    logEntry.client = getClientMetadata(req)
  }

  // Add timestamp if not already present
  if (!logEntry.timestamp) {
    logEntry.timestamp = new Date().toISOString()
  }

  // Format for console output
  const emoji = getEmojiForLevel(level)
  const message = `${emoji} [AUDIT] ${event}${data.email ? ` - ${data.email}` : ''}${logEntry.client ? ` - IP: ${logEntry.client.ip}` : ''}`

  // Log to console (Vercel captures these)
  console.log(message, JSON.stringify(logEntry, null, 2))

  // TODO: Send to external logging service in production
  // Example: await sendToDatadog(logEntry)
  // Example: await sendToSentry(logEntry)

  return logEntry
}

/**
 * Get emoji for log level
 */
function getEmojiForLevel(level) {
  switch (level) {
    case AuditLevel.INFO:
      return 'ℹ️'
    case AuditLevel.WARN:
      return '⚠️'
    case AuditLevel.ERROR:
      return '❌'
    case AuditLevel.SECURITY:
      return '🔐'
    default:
      return '📝'
  }
}

/**
 * Convenience functions for common audit events
 */

export function logAuthSuccess(email, req, userInfo = {}) {
  return logAuditEvent(
    AuditLevel.INFO,
    AuditEvent.AUTH_SUCCESS,
    { email, action: 'User signed in successfully' },
    req
  )
}

export function logAuthFailure(reason, email = null, req) {
  return logAuditEvent(
    AuditLevel.WARN,
    AuditEvent.AUTH_FAILURE,
    { reason, email, action: 'Authentication attempt failed' },
    req
  )
}

export function logInvalidDomain(email, domain, req) {
  return logAuditEvent(
    AuditLevel.SECURITY,
    AuditEvent.AUTH_INVALID_DOMAIN,
    { email, domain, action: 'Invalid domain access attempt' },
    req
  )
}

export function logSessionRefresh(email, req) {
  return logAuditEvent(
    AuditLevel.INFO,
    AuditEvent.SESSION_REFRESH,
    { email, action: 'Session refreshed' },
    req
  )
}

export function logSessionInvalid(reason, req) {
  return logAuditEvent(
    AuditLevel.WARN,
    AuditEvent.SESSION_INVALID,
    { reason, action: 'Invalid session detected' },
    req
  )
}

export function logRateLimitExceeded(endpoint, req) {
  return logAuditEvent(
    AuditLevel.SECURITY,
    AuditEvent.RATE_LIMIT_EXCEEDED,
    { endpoint, action: 'Rate limit exceeded' },
    req
  )
}

export function logSignOut(email, req) {
  return logAuditEvent(
    AuditLevel.INFO,
    AuditEvent.SIGNOUT_SUCCESS,
    { email, action: 'User signed out' },
    req
  )
}
