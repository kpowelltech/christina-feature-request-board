# Authentication Setup Guide

This guide will help you set up Google OAuth authentication for the Feature Request Board application.

## Overview

The application now uses **Google OAuth 2.0** with **domain restriction** to ensure only `@tapcart.co` email addresses can access the platform. All authentication is managed via JWT tokens stored in HTTP-only secure cookies.

## Quick Start

### 1. Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
# Root dependencies (backend)
npm install

# Frontend dependencies
cd feature-request-board && npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

**Required environment variables:**

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Application URL
NEXTAUTH_URL="http://localhost:5173"

# JWT Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-random-secret-here"

# Auth Version
AUTH_VERSION="1"

# Database (already configured)
DATABASE_URL="your-neon-postgres-url"
```

### 3. Set Up Google OAuth Credentials

#### A. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (optional, for profile data)

#### B. Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Select **Internal** (for Google Workspace users only)
3. Fill in:
   - App name: `Tapcart Feature Request Board`
   - User support email: Your Tapcart email
   - Developer contact email: Your Tapcart email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Save and continue

#### C. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `Feature Request Board`
5. **Authorized JavaScript origins:**
   - `http://localhost:5173` (local development)
   - `https://your-domain.vercel.app` (production)
6. **Authorized redirect URIs:**
   - `http://localhost:5173/api/auth-callback` (local)
   - `https://your-domain.vercel.app/api/auth-callback` (production)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### 4. Update Database Schema

Run the database migration to add user tracking columns:

```bash
npm run db:init
```

This will add:
- `created_by_email` - Email of user who created the request
- `updated_by_email` - Email of user who last updated the request

### 5. Start the Development Server

```bash
# Terminal 1: Start Vite frontend (from root)
cd feature-request-board && npm run dev

# Application will be available at http://localhost:5173
```

The app will automatically redirect unauthenticated users to the sign-in page.

## Authentication Flow

### 1. Sign In
- User visits the app
- If not authenticated, redirected to [/signin](http://localhost:5173/signin)
- User clicks "Sign in with Google"
- Redirected to Google OAuth consent screen
- **Domain restriction**: Only `@tapcart.co` emails allowed

### 2. OAuth Callback
- Google redirects back with authorization code
- Backend exchanges code for tokens
- **Triple validation**:
  1. Email verified by Google
  2. Hosted domain (`hd`) claim = `tapcart.co`
  3. Email domain = `@tapcart.co`
- JWT created with 7-day expiry
- Stored in HTTP-only secure cookie

### 3. Session Management
- Session checked on app load
- Auto-refresh every 6 days (before 7-day expiry)
- Session validated every 5 minutes
- JWT includes:
  - User email
  - User name
  - Profile picture
  - Auth version

### 4. Sign Out
- Clears session cookie
- Redirects to sign-in page

## API Protection

All API endpoints are now protected with authentication:

### Protected Endpoints:
- `GET /api/requests/[channel]` - Fetch requests
- `POST /api/requests/create` - Create request (tracks creator)
- `PATCH /api/requests/update` - Update request (tracks updater)

### Authentication Headers:
Cookies are automatically sent by the browser. No manual headers needed.

### Unauthorized Response:
```json
{
  "error": "Unauthorized",
  "message": "You must be signed in to access this resource"
}
```

## Security Features

### 1. Domain Restriction
- Only `@tapcart.co` emails can sign in
- Enforced at three levels:
  1. OAuth `hd` parameter (pre-filter)
  2. ID token `hd` claim validation
  3. Email domain suffix check

### 2. JWT Security
- Signed with `NEXTAUTH_SECRET`
- HTTP-only cookies (prevents XSS)
- Secure flag (HTTPS only in production)
- SameSite=Lax (CSRF protection)
- 7-day expiry with auto-refresh

### 3. Rate Limiting
- Auth endpoints limited to 10 requests/15 minutes per IP
- Refresh endpoint limited to 5 requests/15 minutes per IP
- In-memory implementation (resets on cold start)

### 4. Audit Logging
- All authentication events logged to console
- Captures:
  - Sign-in success/failure
  - Invalid domain attempts
  - Session refresh
  - Sign-out
  - Rate limit violations
- Includes IP address, user agent, timestamp

### 5. Auth Version
- `AUTH_VERSION` environment variable
- Increment to force all users to re-authenticate
- Useful for security incidents or major changes

## Vercel Deployment

### 1. Add Environment Variables

In Vercel Dashboard > Project > Settings > Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `GOOGLE_CLIENT_ID` | Your OAuth client ID | All |
| `GOOGLE_CLIENT_SECRET` | Your OAuth secret | All (mark as Sensitive) |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | Production |
| `NEXTAUTH_SECRET` | Random secret (32+ chars) | All (mark as Sensitive) |
| `AUTH_VERSION` | `1` | All |
| `DATABASE_URL` | (Already configured) | All |

### 2. Update Google OAuth Redirect URIs

Add your Vercel deployment URL to authorized redirect URIs:
- `https://your-domain.vercel.app/api/auth-callback`
- `https://*.vercel.app/api/auth-callback` (for preview deployments)

### 3. Deploy

```bash
git add .
git commit -m "Add Google OAuth authentication"
git push origin main
```

Vercel will automatically deploy on push.

## Testing

### Test Authentication Flow

1. **Valid User** (@tapcart.co):
   ```
   ✓ Should redirect to Google
   ✓ Should authenticate successfully
   ✓ Should show user profile in header
   ✓ Should access protected endpoints
   ```

2. **Invalid User** (other domains):
   ```
   ✗ Should be rejected at OAuth callback
   ✗ Should redirect to /signin with error
   ✗ Error: "Access denied. Only @tapcart.co email addresses are allowed."
   ```

3. **Session Refresh**:
   ```
   ✓ Should auto-refresh before expiry
   ✓ Should maintain session across page refreshes
   ✓ Should redirect to /signin on expired session
   ```

4. **API Protection**:
   ```bash
   # Without auth
   curl http://localhost:5173/api/requests/product
   # Returns 401 Unauthorized

   # With valid session cookie
   curl http://localhost:5173/api/requests/product \
     -H "Cookie: session=valid-jwt-token"
   # Returns data
   ```

## Troubleshooting

### "Configuration error: NEXTAUTH_URL not configured"
**Solution**: Add `NEXTAUTH_URL` to your environment variables

### "OAuth authentication failed"
**Solution**:
1. Check that redirect URIs match exactly in Google Cloud Console
2. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
3. Check browser console for errors

### "Access denied. Only @tapcart.co email addresses are allowed"
**Solution**: This is working as intended. Only Tapcart employees can access the app.

### "Session expired - please sign in again"
**Solution**:
1. Check that `NEXTAUTH_SECRET` is set and consistent
2. Verify `AUTH_VERSION` hasn't changed
3. Try clearing cookies and signing in again

### Vercel deployment not authenticating
**Solution**:
1. Verify environment variables are set in Vercel dashboard
2. Check that `NEXTAUTH_URL` matches your production domain
3. Ensure redirect URIs include Vercel domain
4. Redeploy after adding environment variables

## Architecture

### File Structure

```
christina-feature-request-board/
├── api/
│   ├── auth-google.js          # OAuth initiation
│   ├── auth-callback.js        # OAuth callback handler
│   ├── auth-session.js         # Get current session
│   ├── auth-refresh.js         # Refresh JWT token
│   ├── auth-signout.js         # Clear session
│   ├── _lib/
│   │   ├── authMiddleware.js   # Auth protection wrapper
│   │   ├── rateLimiter.js      # Rate limiting utility
│   │   └── auditLogger.js      # Security event logging
│   └── requests/
│       ├── [channel].js        # Protected: Get requests
│       ├── create.js           # Protected: Create request
│       └── update.js           # Protected: Update request
├── feature-request-board/
│   └── src/
│       ├── contexts/
│       │   └── AuthContext.jsx # React auth context
│       ├── pages/
│       │   └── SignIn.jsx      # Sign-in page
│       ├── App.jsx             # Main app (with auth)
│       └── main.jsx            # Router with auth
└── database/
    └── init.js                 # Schema with user tracking
```

### Key Components

#### Backend
- **authMiddleware.js**: Wraps API routes with JWT validation
- **rateLimiter.js**: In-memory rate limiting for auth endpoints
- **auditLogger.js**: Logs security events to console

#### Frontend
- **AuthContext.jsx**: Manages auth state globally
- **SignIn.jsx**: OAuth sign-in page
- **Router** (in main.jsx): Redirects unauthenticated users

### Security Best Practices

✅ **Implemented:**
- Domain-restricted OAuth
- HTTP-only secure cookies
- JWT with short expiry + auto-refresh
- Rate limiting on auth endpoints
- Audit logging
- CSRF protection (SameSite cookies)
- Input validation on all endpoints
- User tracking on create/update operations

🔄 **Recommended for Production:**
- Migrate rate limiting to Redis/Upstash
- Send audit logs to external service (Datadog, Sentry)
- Add role-based access control (RBAC)
- Implement API request logging
- Add security headers middleware
- Set up alerting for suspicious activity

## Support

For issues or questions:
1. Check this guide first
2. Review the [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2)
3. Check Vercel logs: `vercel logs`
4. Contact your team's tech lead

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
