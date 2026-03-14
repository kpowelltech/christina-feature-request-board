/**
 * Vercel Serverless Function: /api/auth-signout
 * Clears user session
 */

import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { logSignOut } from './_lib/auditLogger.js'

export default async function handler(req, res) {
  // Try to get user email from session before clearing (for audit log)
  let userEmail = 'unknown'
  try {
    const cookies = cookie.parse(req.headers.cookie || '')
    const sessionToken = cookies.session
    if (sessionToken) {
      const decoded = jwt.verify(sessionToken, process.env.NEXTAUTH_SECRET)
      userEmail = decoded.email || 'unknown'
    }
  } catch (error) {
    // Ignore errors - session may already be invalid
  }

  // Clear session cookie
  res.setHeader(
    'Set-Cookie',
    'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  )

  console.log(`👋 User signed out: ${userEmail}`)
  logSignOut(userEmail, req)

  return res.status(200).json({ success: true })
}
