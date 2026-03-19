/**
 * Vercel Serverless Function
 * DELETE /api/requests/delete - Delete a feature request
 * PROTECTED: Requires authentication
 */

import { neon } from '@neondatabase/serverless';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.body;

    // Validate required fields
    if (!id) {
      return res.status(400).json({ error: 'Missing required field: id' });
    }

    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    // Get authenticated user email for audit logging
    const deletedByEmail = req.user.email;

    // Delete the request
    const rows = await sql`
      DELETE FROM feature_requests
      WHERE id = ${id}
      RETURNING id, merchant, request
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Log the deletion
    console.log(`Request deleted by ${deletedByEmail}:`, {
      id: rows[0].id,
      merchant: rows[0].merchant,
      request: rows[0].request
    });

    return res.status(200).json({
      message: 'Feature request deleted successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to delete request',
      details: error.message
    });
  }
}

// Export with auth middleware
export default withAuth(handler);
