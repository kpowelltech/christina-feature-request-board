/**
 * Vercel Serverless Function
 * POST /api/requests/create - Create a new feature request
 * PROTECTED: Requires authentication
 */

import { neon } from '@neondatabase/serverless';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      id,
      merchant,
      mrr = 0,
      arr = 0,
      type,
      category,
      requestGroup,
      request,
      context = null,
      submittedBy = 'Unknown',
      date,
      status = 'pending',
      asanaId = null,
      slackTs = null,
      slackUser = null,
      channel = 'product'
    } = req.body;

    // Validate required fields
    if (!id || !merchant || !type || !category || !requestGroup || !request || !date) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['id', 'merchant', 'type', 'category', 'requestGroup', 'request', 'date']
      });
    }

    // Validate type
    if (!['feature', 'integration'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "feature" or "integration"' });
    }

    // Validate status
    if (!['pending', 'sent_to_slack', 'asana_created'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Validate channel
    if (!['product', 'ai'].includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel. Must be "product" or "ai"' });
    }

    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    // Get authenticated user email
    const createdByEmail = req.user.email;

    // Insert into database with audit tracking
    const rows = await sql`
      INSERT INTO feature_requests (
        id, merchant, mrr, arr, type, category, request_group, request,
        context, submitted_by, date, status, asana_id, slack_ts, slack_user, channel,
        created_by_email
      )
      VALUES (
        ${id}, ${merchant}, ${mrr}, ${arr}, ${type}, ${category}, ${requestGroup}, ${request},
        ${context}, ${submittedBy}, ${date}, ${status}, ${asanaId}, ${slackTs}, ${slackUser}, ${channel},
        ${createdByEmail}
      )
      RETURNING *
    `;

    return res.status(201).json({
      message: 'Feature request created successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);

    // Handle duplicate key error
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Request with this ID already exists' });
    }

    return res.status(500).json({
      error: 'Failed to create request',
      details: error.message
    });
  }
}

// Export with auth middleware
export default withAuth(handler);
