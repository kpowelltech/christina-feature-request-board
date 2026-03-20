/**
 * Vercel Serverless Function
 * POST /api/requests/suggest-combine - AI-powered merge suggestions
 * Uses Claude to identify entries that should be grouped under the same topic
 * PROTECTED: Requires authentication
 */

import { neon } from '@neondatabase/serverless';
import Anthropic from '@anthropic-ai/sdk';
import { withAuth } from '../_lib/authMiddleware.js';

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
    const { channel } = req.body;

    if (!channel || !['product', 'ai'].includes(channel)) {
      return res.status(400).json({ error: 'Must provide channel: "product" or "ai"' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Map channel param to DB channel value
    const dbChannel = channel === 'product' ? '#product' : '#ai-feedback';

    // Fetch all active entries for this channel
    const rows = await sql`
      SELECT id, merchant, category, topic, request_group, request, context
      FROM feature_requests
      WHERE channel = ${dbChannel}
        AND deleted_at IS NULL
        AND status != 'done'
      ORDER BY category, topic
    `;

    if (rows.length < 2) {
      return res.status(200).json({ suggestions: [], message: 'Not enough entries to suggest merges' });
    }

    // Build a compact representation for Claude
    const entrySummaries = rows.map(r => ({
      id: r.id,
      topic: r.topic || r.request_group || '(none)',
      category: r.category || '(none)',
      request: (r.request || '').slice(0, 150),
      context: (r.context || '').slice(0, 100),
    }));

    const prompt = `You are analyzing a feature request board. Below are entries, each with an ID, current topic, category, and request text.

Your job: identify groups of entries that are about the SAME underlying feature or need but are currently under DIFFERENT topics. These should be merged under a single topic.

Rules:
- Only suggest merges where entries are clearly about the same thing
- Do NOT merge entries that are merely in the same category but about different features
- The targetTopic should be a clear, concise name (2-5 words, title case)
- Each suggestion must include at least 2 entry IDs
- Prefer using an existing topic name when one is good enough
- Keep suggestions conservative — only obvious merges

Entries:
${entrySummaries.map(e => `[${e.id}] Topic: "${e.topic}" | Category: ${e.category} | Request: ${e.request}${e.context ? ` | Context: ${e.context}` : ''}`).join('\n')}

Return a JSON array of merge suggestions. Each suggestion has:
- targetTopic: the topic name to merge under
- ids: array of entry IDs to merge
- reason: brief explanation (1 sentence)

Return ONLY valid JSON, no markdown fences. Example:
[{"targetTopic": "Push Timing Controls", "ids": ["id-1", "id-2"], "reason": "Both request configurable push notification timing restrictions."}]

If no merges are warranted, return an empty array: []`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text.trim();

    let suggestions;
    try {
      suggestions = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({ error: 'AI returned invalid JSON', raw: responseText });
    }

    if (!Array.isArray(suggestions)) {
      suggestions = [];
    }

    // Validate each suggestion has required fields
    suggestions = suggestions.filter(s =>
      s.targetTopic && Array.isArray(s.ids) && s.ids.length >= 2 && s.reason
    );

    // Enrich suggestions with entry details
    const enriched = suggestions.map(s => ({
      ...s,
      entries: s.ids.map(id => {
        const entry = rows.find(r => r.id === id);
        return entry ? {
          id: entry.id,
          merchant: entry.merchant,
          topic: entry.topic || entry.request_group,
          request: (entry.request || '').slice(0, 120),
        } : { id, merchant: '(unknown)', topic: '(unknown)', request: '' };
      })
    }));

    return res.status(200).json({ suggestions: enriched });
  } catch (error) {
    console.error('AI suggest-combine error:', error);
    return res.status(500).json({
      error: 'Failed to generate merge suggestions',
      details: error.message
    });
  }
}

export default withAuth(handler);
