/**
 * migrateAICategories.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Migrates AI feedback records to use the new 7-category structure
 *
 * Old categories: Push Notifications, Personalization, Analytics, Media, etc.
 * New categories: AI Push Flows, For You Feed, AI Content & Video Generation,
 *                 AI Autopilot, AI Billing & Pricing, Analytics & Reporting, Other
 *
 * Usage:
 *   node migrateAICategories.js              # dry-run (preview only)
 *   node migrateAICategories.js --execute    # execute migration
 *   node migrateAICategories.js --channel ai # migrate only AI feedback
 *
 * Features:
 *   - Hybrid approach: SQL mapping for clear cases, AI for ambiguous
 *   - Batch processing with rate limiting
 *   - Dry-run mode to preview changes
 *   - Progress reporting
 *   - Rollback-friendly logging
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";

// ─── Config ───────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--execute');
const BATCH_SIZE = 4; // Claude API rate limit: 5 req/min, use 4 to be safe
const BATCH_DELAY_MS = 15000; // 15 seconds between batches

const sql = neon(process.env.DATABASE_URL);
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Category Mapping ─────────────────────────────────────────────────────────
// Direct mappings (no AI needed)
const DIRECT_CATEGORY_MAPPING = {
  'AI Push Flows': [
    'Push Notifications',
    'Push Flows',
    'Push',
    'Notifications'
  ],
  'Analytics & Reporting': [
    'Analytics',
    'Reporting',
    'Dashboard'
  ],
  'AI Content & Video Generation': [
    'Media',
    'Video',
    'Images',
    'Content',
    'AI Copy'
  ],
  'Other': [
    'Integrations',
    'Promotions',
    'Compliance',
    'Documentation',
    'API/Dev'
  ]
};

// ─── Topic Assignment (matching slackSyncDB.js logic) ────────────────────────
function assignTopic(category, requestGroup, request, context) {
  const lowerRequest = (request + " " + (context || "")).toLowerCase();

  // AI PUSH FLOWS SUBTOPICS
  if (category === "AI Push Flows") {
    if (lowerRequest.match(/welcome|onboarding/)) return "Welcome Flow";
    if (lowerRequest.match(/abandon.*cart|cart.*abandon|cart recovery/)) return "Abandon Cart Flow";
    if (lowerRequest.match(/browse.*abandon/)) return "Browse Abandonment Flow";
    if (lowerRequest.match(/winback|win.*back/)) return "Winback Flow";
    if (lowerRequest.match(/tuning|guardrail|audience|feedback.*control|user.*exclusion|control/)) return "AI Tuning & Guardrails";
    if (lowerRequest.match(/discount|code|promo/)) return "Discount Codes";
    if (lowerRequest.match(/translat|spanish|language|localization/)) return "Translations";
    if (lowerRequest.match(/quiet.*hour|time.*restrict|timing|send.*time|scheduling/)) return "Time Restrictions";
    if (lowerRequest.match(/personalization|custom|tailor/)) return "Personalization";
    if (lowerRequest.match(/performance|optimization|speed/)) return "Performance";
    return requestGroup || "General Push Flows";
  }

  // FOR YOU FEED SUBTOPICS
  if (category === "For You Feed") {
    if (lowerRequest.match(/discovery|browse|explore/)) return "Product Discovery";
    if (lowerRequest.match(/recommend|suggestion|personali/)) return "Recommendations";
    if (lowerRequest.match(/integration|data|sync/)) return "Data Integration";
    if (lowerRequest.match(/ui|interface|design|layout/)) return "UI/UX";
    if (lowerRequest.match(/performance|speed|load/)) return "Performance";
    return requestGroup || "General FYF";
  }

  // AI CONTENT & VIDEO GENERATION SUBTOPICS
  if (category === "AI Content & Video Generation") {
    if (lowerRequest.match(/video.*generat|generat.*video/)) return "Video Generation";
    if (lowerRequest.match(/video.*edit/)) return "Video Editing";
    if (lowerRequest.match(/video.*ui|video.*interface/)) return "Video UI";
    if (lowerRequest.match(/image|photo|picture/)) return "Image Generation";
    if (lowerRequest.match(/copy|text|caption|description|writing/)) return "Copy Generation";
    if (lowerRequest.match(/template|style|brand/)) return "Templates & Styling";
    return requestGroup || "General Content";
  }

  // AI AUTOPILOT SUBTOPICS
  if (category === "AI Autopilot") {
    if (lowerRequest.match(/automation|auto.*mode/)) return "Automation";
    if (lowerRequest.match(/control|override|manual/)) return "Controls";
    if (lowerRequest.match(/config|setting|preference/)) return "Configuration";
    return requestGroup || "General Autopilot";
  }

  // AI BILLING & PRICING SUBTOPICS
  if (category === "AI Billing & Pricing") {
    if (lowerRequest.match(/credit|usage|consumption/)) return "Credits & Usage";
    if (lowerRequest.match(/trial|demo|test/)) return "Trials";
    if (lowerRequest.match(/pric|cost|fee|charge/)) return "Pricing";
    if (lowerRequest.match(/bill|invoice|payment/)) return "Billing";
    if (lowerRequest.match(/plan|tier|subscription/)) return "Plans & Tiers";
    return requestGroup || "General Billing";
  }

  // ANALYTICS & REPORTING SUBTOPICS
  if (category === "Analytics & Reporting") {
    if (lowerRequest.match(/push.*analytic|push.*metric/)) return "Push Analytics";
    if (lowerRequest.match(/attribution|credit.*track|conversion.*track/)) return "Attribution";
    if (lowerRequest.match(/dashboard|visual/)) return "Dashboards";
    if (lowerRequest.match(/export|download|report/)) return "Reporting";
    if (lowerRequest.match(/accuracy|discrepancy|data.*quality/)) return "Data Accuracy";
    if (lowerRequest.match(/fyf|feed.*analytic/)) return "FYF Analytics";
    return requestGroup || "General Analytics";
  }

  // OTHER CATEGORY
  if (category === "Other") {
    return requestGroup || "Uncategorized";
  }

  return null;
}

// ─── AI-Powered Category Assignment ──────────────────────────────────────────
async function categorizeWithAI(record) {
  if (!anthropic) {
    console.warn(`[AI] No API key, defaulting to "Other" for ${record.id}`);
    return "Other";
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `Categorize this AI product feedback into ONE of these categories:

Categories:
1. AI Push Flows - Push notifications, flows (welcome, abandon cart, winback), AI tuning, guardrails
2. For You Feed - Product discovery, recommendations, FYF features
3. AI Content & Video Generation - AI-generated copy, images, videos, media
4. AI Autopilot - Autopilot features, autonomous AI behavior
5. AI Billing & Pricing - Credits, trials, billing, pricing, subscriptions
6. Analytics & Reporting - Dashboards, metrics, attribution, performance data
7. Other - Anything else

Feedback:
Merchant: ${record.merchant}
Request: ${record.request}
${record.context ? `Context: ${record.context}` : ''}
Current Category: ${record.category}

Return ONLY the category name, nothing else.`
      }]
    });

    const category = response.content[0]?.text?.trim();
    const validCategories = [
      'AI Push Flows',
      'For You Feed',
      'AI Content & Video Generation',
      'AI Autopilot',
      'AI Billing & Pricing',
      'Analytics & Reporting',
      'Other'
    ];

    return validCategories.includes(category) ? category : "Other";
  } catch (err) {
    console.warn(`[AI] Error categorizing ${record.id}: ${err.message}`);
    return "Other";
  }
}

// ─── Direct Mapping ───────────────────────────────────────────────────────────
function getDirectMapping(oldCategory) {
  for (const [newCategory, oldCategories] of Object.entries(DIRECT_CATEGORY_MAPPING)) {
    if (oldCategories.some(old => oldCategory.toLowerCase().includes(old.toLowerCase()))) {
      return newCategory;
    }
  }
  return null; // Requires AI categorization
}

// ─── Main Migration ───────────────────────────────────────────────────────────
async function migrate() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║       AI Feedback Category Migration                          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be made to the database");
    console.log("   Run with --execute flag to apply changes\n");
  } else {
    console.log("⚠️  EXECUTE MODE - Changes will be written to database\n");
  }

  // Fetch AI feedback records
  console.log("📊 Fetching AI feedback records...");
  const records = await sql`
    SELECT id, merchant, category, topic, request_group, request, context,
           submitted_by, date, mrr, arr
    FROM feature_requests
    WHERE channel = '#ai-feedback'
      AND deleted_at IS NULL
    ORDER BY date DESC
  `;

  console.log(`   Found ${records.length} records\n`);

  if (records.length === 0) {
    console.log("✅ No records to migrate");
    return;
  }

  // Categorize records
  const updates = [];
  const directMapped = [];
  const aiMapped = [];

  console.log("🔄 Analyzing categories...\n");

  for (const record of records) {
    const directCategory = getDirectMapping(record.category);

    if (directCategory) {
      const newTopic = assignTopic(directCategory, record.request_group, record.request, record.context);
      updates.push({
        id: record.id,
        oldCategory: record.category,
        newCategory: directCategory,
        oldTopic: record.topic,
        newTopic,
        method: 'direct'
      });
      directMapped.push(record);
    } else {
      // Needs AI categorization
      aiMapped.push(record);
    }
  }

  console.log(`   Direct mapping: ${directMapped.length} records`);
  console.log(`   AI needed: ${aiMapped.length} records\n`);

  // Process AI categorization in batches
  if (aiMapped.length > 0) {
    console.log("🤖 Using Claude AI for ambiguous cases...");

    for (let i = 0; i < aiMapped.length; i += BATCH_SIZE) {
      const batch = aiMapped.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(aiMapped.length / BATCH_SIZE);

      console.log(`   Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      for (const record of batch) {
        const newCategory = await categorizeWithAI(record);
        const newTopic = assignTopic(newCategory, record.request_group, record.request, record.context);

        updates.push({
          id: record.id,
          oldCategory: record.category,
          newCategory,
          oldTopic: record.topic,
          newTopic,
          method: 'ai'
        });
      }

      // Rate limiting delay
      if (i + BATCH_SIZE < aiMapped.length) {
        console.log(`   Waiting ${BATCH_DELAY_MS / 1000}s for rate limit...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    console.log();
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📋 Migration Summary\n");

  const categoryCounts = {};
  updates.forEach(u => {
    categoryCounts[u.newCategory] = (categoryCounts[u.newCategory] || 0) + 1;
  });

  Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} records`);
  });

  console.log("\n═══════════════════════════════════════════════════════════════\n");

  // Show sample changes
  console.log("📝 Sample Changes (first 10):\n");
  updates.slice(0, 10).forEach(u => {
    console.log(`   ${u.id}`);
    console.log(`   └─ Category: "${u.oldCategory}" → "${u.newCategory}"`);
    if (u.oldTopic !== u.newTopic) {
      console.log(`   └─ Topic: "${u.oldTopic || '(none)'}" → "${u.newTopic || '(none)'}"`);
    }
    console.log();
  });

  if (updates.length > 10) {
    console.log(`   ... and ${updates.length - 10} more\n`);
  }

  // Execute updates
  if (!DRY_RUN) {
    console.log("💾 Applying updates to database...\n");

    let success = 0;
    let failed = 0;

    for (const update of updates) {
      try {
        await sql`
          UPDATE feature_requests
          SET category = ${update.newCategory},
              topic = ${update.newTopic},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${update.id}
        `;
        success++;
        if (success % 50 === 0) {
          console.log(`   Updated ${success}/${updates.length} records...`);
        }
      } catch (err) {
        console.error(`   ❌ Failed to update ${update.id}: ${err.message}`);
        failed++;
      }
    }

    console.log();
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`✅ Migration complete!`);
    console.log(`   Success: ${success} records`);
    if (failed > 0) {
      console.log(`   Failed: ${failed} records`);
    }
  } else {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("✅ Dry run complete - run with --execute to apply changes");
  }

  console.log();
}

// ─── Run ──────────────────────────────────────────────────────────────────────
migrate().catch(err => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
