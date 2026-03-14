/**
 * Vercel Serverless Function
 * GET /api/requests/[channel] - Fetch all feature requests for a specific channel
 * Example: GET /api/requests/product or GET /api/requests/ai
 * PROTECTED: Requires authentication
 */

import { neon } from '@neondatabase/serverless';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { channel } = req.query;

    // Validate channel
    if (!['product', 'ai'].includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel. Must be "product" or "ai"' });
    }

    // Map URL channel to database channel
    const channelMap = {
      'product': '#product',
      'ai': '#ai-feedback'
    };
    const dbChannel = channelMap[channel];

    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    // Query database
    const rows = await sql`
      SELECT
        id,
        merchant,
        mrr,
        arr,
        type,
        category,
        request_group AS "requestGroup",
        request,
        context,
        submitted_by AS "submittedBy",
        to_char(date, 'YYYY-MM-DD') AS date,
        status,
        asana_id AS "asanaId",
        slack_ts AS "slackTs",
        slack_user AS "slackUser",
        channel
      FROM feature_requests
      WHERE channel = ${dbChannel}
      ORDER BY date DESC
    `;

    return res.status(200).json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to fetch requests',
      details: error.message
    });
  }
}

// Export with auth middleware
export default withAuth(handler);
