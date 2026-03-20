/**
 * Vercel Serverless Function
 * PATCH /api/requests/edit - Full edit capability for feature requests
 * PROTECTED: Requires authentication
 */

import { neon } from '@neondatabase/serverless';
import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      id,
      merchant,
      appId,
      mrr,
      arr,
      type,
      category,
      requestGroup,
      topic,
      request,
      context,
      submittedBy,
      status,
      asanaId,
      slackTs
    } = req.body;

    // Validate required field
    if (!id) {
      return res.status(400).json({ error: 'Missing required field: id' });
    }

    // Validate type if provided
    if (type && !['feature', 'integration'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "feature" or "integration"' });
    }

    // Validate status if provided
    if (status && !['pending', 'in_progress', 'qa', 'done', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    // Get authenticated user email for audit tracking
    const updatedByEmail = req.user.email;

    // Build update object dynamically
    const updates = [];
    const values = { id };

    if (merchant !== undefined) {
      updates.push('merchant = ${merchant}');
      values.merchant = merchant;
    }
    if (appId !== undefined) {
      updates.push('app_id = ${appId}');
      values.appId = appId;
    }
    if (mrr !== undefined) {
      updates.push('mrr = ${mrr}');
      values.mrr = mrr;
    }
    if (arr !== undefined) {
      updates.push('arr = ${arr}');
      values.arr = arr;
    }
    if (type !== undefined) {
      updates.push('type = ${type}');
      values.type = type;
    }
    if (category !== undefined) {
      updates.push('category = ${category}');
      values.category = category;
    }
    if (requestGroup !== undefined) {
      updates.push('request_group = ${requestGroup}');
      values.requestGroup = requestGroup;
    }
    if (topic !== undefined) {
      updates.push('topic = ${topic}');
      values.topic = topic;
    }
    if (request !== undefined) {
      updates.push('request = ${request}');
      values.request = request;
    }
    if (context !== undefined) {
      updates.push('context = ${context}');
      values.context = context;
    }
    if (submittedBy !== undefined) {
      updates.push('submitted_by = ${submittedBy}');
      values.submittedBy = submittedBy;
    }
    if (status !== undefined) {
      updates.push('status = ${status}');
      values.status = status;
    }
    if (asanaId !== undefined) {
      updates.push('asana_id = ${asanaId}');
      values.asanaId = asanaId;
    }
    if (slackTs !== undefined) {
      updates.push('slack_ts = ${slackTs}');
      values.slackTs = slackTs;
    }

    // Always update audit fields
    updates.push('updated_by_email = ${updatedByEmail}');
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.updatedByEmail = updatedByEmail;

    if (updates.length === 2) {
      // Only audit fields, no actual updates
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Execute update query
    const rows = await sql`
      UPDATE feature_requests
      SET
        merchant = COALESCE(${values.merchant}, merchant),
        app_id = COALESCE(${values.appId}, app_id),
        mrr = COALESCE(${values.mrr}, mrr),
        arr = COALESCE(${values.arr}, arr),
        type = COALESCE(${values.type}, type),
        category = COALESCE(${values.category}, category),
        request_group = COALESCE(${values.requestGroup}, request_group),
        topic = COALESCE(${values.topic}, topic),
        request = COALESCE(${values.request}, request),
        context = COALESCE(${values.context}, context),
        submitted_by = COALESCE(${values.submittedBy}, submitted_by),
        status = COALESCE(${values.status}, status),
        asana_id = COALESCE(${values.asanaId}, asana_id),
        slack_ts = COALESCE(${values.slackTs}, slack_ts),
        updated_by_email = ${values.updatedByEmail},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${values.id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Convert snake_case to camelCase for frontend
    const data = {
      id: rows[0].id,
      merchant: rows[0].merchant,
      appId: rows[0].app_id,
      mrr: rows[0].mrr,
      arr: rows[0].arr,
      type: rows[0].type,
      category: rows[0].category,
      requestGroup: rows[0].request_group,
      topic: rows[0].topic,
      request: rows[0].request,
      context: rows[0].context,
      submittedBy: rows[0].submitted_by,
      date: rows[0].date,
      status: rows[0].status,
      asanaId: rows[0].asana_id,
      slackTs: rows[0].slack_ts,
      slackUser: rows[0].slack_user,
      channel: rows[0].channel,
      isWorkflow: rows[0].is_workflow,
      createdByEmail: rows[0].created_by_email,
      updatedByEmail: rows[0].updated_by_email,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };

    return res.status(200).json({
      message: 'Feature request updated successfully',
      data
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to update request',
      details: error.message
    });
  }
}

// Export with auth middleware
export default withAuth(handler);
