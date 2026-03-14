/**
 * Show what messages Claude is skipping and why
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const SLACK_API_BASE = "https://slack.com/api";
const CHANNEL_ID = process.env.AI_FEEDBACK_CHANNEL_ID;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PARSE_SYSTEM_PROMPT = `You are a Slack message parser for a feature request board.
Parse the message and return ONLY valid JSON (no markdown, no explanations) with these fields:
{
  "merchant": "Company Name",
  "type": "feature" or "integration",
  "category": "Product" | "Push Notifications" | "Analytics" | "Media" | "Integrations",
  "requestGroup": "A concise category for grouping similar requests",
  "context": "One-sentence summary of the request",
  "submittedBy": "Name if mentioned, else 'Unknown'"
}

Guidelines:
- merchant should be extracted from the message if mentioned
- requestGroup must be concise and reusable — similar requests from different merchants should get the same requestGroup
- context should be a helpful one-sentence summary that captures the essence of the request
- If the message is clearly not a product request (e.g. just a reaction, link, or off-topic), return {"skip": true}`;

async function slackFetch(endpoint, params = {}) {
  const url = new URL(`${SLACK_API_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

async function parseWithClaude(text) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Channel: #ai-feedback\n\nMessage:\n${text}`,
        },
      ],
    });

    let raw = response.content[0]?.text?.trim() || "{}";

    // Strip markdown code block wrappers if present
    if (raw.startsWith("```json")) {
      raw = raw.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (raw.startsWith("```")) {
      raw = raw.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    return { error: err.message };
  }
}

async function analyzeSkipped() {
  console.log('🔍 Analyzing what Claude is skipping...\n');

  const data = await slackFetch("conversations.history", {
    channel: CHANNEL_ID,
    limit: 20  // Just check first 20 for speed
  });

  const messages = (data.messages || []).filter(m =>
    m.type === "message" &&
    (!m.subtype || m.subtype === "workflow_message" || m.subtype === "bot_message") &&
    m.text?.trim()
  );

  console.log(`Checking first ${messages.length} valid messages...\n`);

  let skipped = 0;
  let kept = 0;
  let errors = 0;

  for (const msg of messages) {
    const isWorkflow = msg.subtype === "bot_message";

    if (isWorkflow) {
      console.log(`✅ WORKFLOW (auto-keep): ${msg.text.slice(0, 60)}...`);
      kept++;
      continue;
    }

    const parsed = await parseWithClaude(msg.text);

    if (parsed.error) {
      console.log(`❌ ERROR: ${msg.text.slice(0, 60)}...`);
      console.log(`   Error: ${parsed.error}\n`);
      errors++;
    } else if (parsed.skip) {
      console.log(`⏭️  SKIPPED: ${msg.text.slice(0, 80)}...`);
      console.log(`   Reason: Not a product request\n`);
      skipped++;
    } else {
      console.log(`✅ KEPT: ${parsed.merchant} - ${parsed.requestGroup}`);
      console.log(`   Text: ${msg.text.slice(0, 60)}...\n`);
      kept++;
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`Results from first ${messages.length} messages:`);
  console.log(`  ✅ Kept: ${kept}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`\nSkip rate: ${(skipped / messages.length * 100).toFixed(1)}%`);
}

analyzeSkipped().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
