/**
 * migrateWorkflowFields.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-parses existing #ai-feedback workflow entries to fix MRR, Topic,
 * Category, Request, and generates AI context summaries.
 *
 * Usage:
 *   node migrateWorkflowFields.js              # dry run (default)
 *   node migrateWorkflowFields.js --apply      # apply changes to database
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Rate limiting
let lastApiCallTime = 0;
const MIN_API_DELAY_MS = 12500;

async function summarizeRequest(requestText) {
  if (!requestText) return null;

  try {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < MIN_API_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_API_DELAY_MS - timeSinceLastCall));
    }
    lastApiCallTime = Date.now();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 128,
      system: "You summarize customer feedback into one concise sentence. Return ONLY the summary, no quotes or explanation.",
      messages: [{ role: "user", content: requestText }],
    });

    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.warn(`[summarize] Failed: ${err.message}`);
    return null;
  }
}

// The only valid AI feedback categories
const AI_CATEGORIES = [
  "AI Push Flows",
  "For You Feed",
  "AI Content & Video Generation",
  "AI Autopilot",
  "AI Billing & Pricing",
  "Analytics & Reporting",
  "Other",
];

function mapToAICategory(rawCategory, requestText) {
  const combined = `${rawCategory || ""} ${requestText || ""}`.toLowerCase();

  if (/push|flow|welcome|abandon|winback|browse abandon|notification|pn\b/i.test(combined)) return "AI Push Flows";
  if (/for you|fyf|feed|discovery|recommend/i.test(combined)) return "For You Feed";
  if (/content|video|image|copy|generat|media/i.test(combined)) return "AI Content & Video Generation";
  if (/autopilot|autonom/i.test(combined)) return "AI Autopilot";
  if (/billing|pricing|credit|trial|subscription/i.test(combined)) return "AI Billing & Pricing";
  if (/analytics|reporting|dashboard|metric|attribution|performance data/i.test(combined)) return "Analytics & Reporting";

  return "Other";
}

function reparse(text) {
  const merchant = text.match(/\*Merchant Name\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;
  const appId = text.match(/\*App ID\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;
  const mrrRaw = text.match(/\*MRR\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || "0";
  const mrr = parseInt(mrrRaw.replace(/[$,]/g, "")) || 0;
  const topic = text.match(/\*Topic:?\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;
  const rawCategory = text.match(/\*Category\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;
  const feedback = text.match(/\*Feedback\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;

  return { merchant, appId, mrr, topic, rawCategory, feedback };
}

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(`\n${ apply ? "🔧 APPLYING" : "👀 DRY RUN" } — Migrate #ai-feedback workflow entries\n`);

  // Only fetch #ai-feedback workflow entries
  const rows = await sql`
    SELECT id, merchant, app_id, mrr, arr, topic, category, request, context
    FROM feature_requests
    WHERE is_workflow = true AND deleted_at IS NULL AND channel = '#ai-feedback'
    ORDER BY id
  `;

  console.log(`Found ${rows.length} #ai-feedback workflow entries\n`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    // The request field now holds the feedback text (from previous migration)
    // Use it directly for summarization
    const requestText = row.request;

    // Generate AI context summary
    console.log(`[${row.id}] ${row.merchant} — generating summary...`);
    const context = await summarizeRequest(requestText);

    if (!context) {
      console.log(`  ⚠ Could not generate summary, skipping\n`);
      skipped++;
      continue;
    }

    updated++;
    console.log(`  context: "${context}"\n`);

    if (apply) {
      await sql`
        UPDATE feature_requests
        SET context = ${context},
            updated_at = NOW()
        WHERE id = ${row.id}
      `;
    }
  }

  console.log(`\n✅ Done — ${updated} entries ${ apply ? "updated" : "would be updated" }, ${skipped} skipped`);
  if (!apply && updated > 0) {
    console.log(`\nRun with --apply to write changes to the database.`);
  }
}

main().catch(err => {
  console.error("[fatal]", err);
  process.exit(1);
});
