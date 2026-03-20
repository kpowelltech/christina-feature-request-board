/**
 * Vercel Serverless Function
 * POST /api/requests/combine - Batch-update topic/category to merge entries
 * PROTECTED: Requires authentication
 */

import { neon } from '@neondatabase/serverless';
import { withAuth } from '../_lib/authMiddleware.js';

function toCamelCase(row) {
  return {
    id: row.id,
    merchant: row.merchant,
    appId: row.app_id,
    mrr: row.mrr,
    arr: row.arr,
    type: row.type,
    category: row.category,
    requestGroup: row.request_group,
    topic: row.topic,
    request: row.request,
    context: row.context,
    submittedBy: row.submitted_by,
    date: row.date,
    status: row.status,
    asanaId: row.asana_id,
    slackTs: row.slack_ts,
    slackUser: row.slack_user,
    channel: row.channel,
    isWorkflow: row.is_workflow,
    createdByEmail: row.created_by_email,
    updatedByEmail: row.updated_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ids, topic, category } = req.body;

    if (!Array.isArray(ids) || ids.length < 1) {
      return res.status(400).json({ error: 'Must provide at least 1 entry ID' });
    }

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'Must provide a target topic' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const updatedByEmail = req.user.email;

    let rows;
    if (category) {
      rows = await sql`
        UPDATE feature_requests
        SET
          topic = ${topic.trim()},
          category = ${category},
          updated_by_email = ${updatedByEmail},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${ids})
          AND deleted_at IS NULL
        RETURNING *
      `;
    } else {
      rows = await sql`
        UPDATE feature_requests
        SET
          topic = ${topic.trim()},
          updated_by_email = ${updatedByEmail},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${ids})
          AND deleted_at IS NULL
        RETURNING *
      `;
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No matching entries found' });
    }

    const data = rows.map(toCamelCase);

    return res.status(200).json({
      message: `Combined ${data.length} entries under topic "${topic.trim()}"`,
      data
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to combine entries',
      details: error.message
    });
  }
}

export default withAuth(handler);
