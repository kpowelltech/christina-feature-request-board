/**
 * Vercel Serverless Function
 * PATCH /api/requests/update - Update a feature request (typically status updates)
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, status, asanaId, slackTs } = req.body;

    // Validate required fields
    if (!id) {
      return res.status(400).json({ error: 'Missing required field: id' });
    }

    // Validate status if provided
    if (status && !['pending', 'sent_to_slack', 'asana_created'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    // Build and execute update query
    let rows;

    if (status && asanaId !== undefined && slackTs !== undefined) {
      rows = await sql`
        UPDATE feature_requests
        SET status = ${status}, asana_id = ${asanaId}, slack_ts = ${slackTs}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (status && asanaId !== undefined) {
      rows = await sql`
        UPDATE feature_requests
        SET status = ${status}, asana_id = ${asanaId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (status && slackTs !== undefined) {
      rows = await sql`
        UPDATE feature_requests
        SET status = ${status}, slack_ts = ${slackTs}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (status) {
      rows = await sql`
        UPDATE feature_requests
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (asanaId !== undefined) {
      rows = await sql`
        UPDATE feature_requests
        SET asana_id = ${asanaId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (slackTs !== undefined) {
      rows = await sql`
        UPDATE feature_requests
        SET slack_ts = ${slackTs}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    return res.status(200).json({
      message: 'Feature request updated successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to update request',
      details: error.message
    });
  }
}
