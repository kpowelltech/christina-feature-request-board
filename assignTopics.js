/**
 * Assign topics to all NULL topic values in the database
 * Uses the same logic as slackSyncDB.js assignTopic() function
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

// ─── Topic Assignment Logic ───────────────────────────────────────────────────
function assignTopic(category, requestGroup, request, context) {
  const lowerRequest = (request + " " + (context || "")).toLowerCase();

  // PUSH FLOWS TOPICS
  if (category === "Push Flows") {
    if (lowerRequest.match(/welcome|onboarding/)) return "Welcome Flow";
    if (lowerRequest.match(/abandon.*cart|cart.*abandon|cart recovery/)) return "Abandon Cart Flow";
    if (lowerRequest.match(/browse.*abandon/)) return "Browse Abandonment Flow";
    if (lowerRequest.match(/winback/)) return "Winback Flow";
    if (lowerRequest.match(/performance|analytics|attribution|roi|conversion/)) return "Push Performance";
    if (lowerRequest.match(/tuning|guardrail|audience|feedback.*control|user.*exclusion|AI.*control/)) return "AI Tuning";
    if (lowerRequest.match(/discount|code|promo/)) return "Discount Codes";
    if (lowerRequest.match(/translat|spanish|language/)) return "Translations";
    if (lowerRequest.match(/quiet.*hour|time.*restrict|timing|send.*time|9pm|1 am/)) return "Time Restrictions / Options";
    return "Push Performance"; // default
  }

  // ANALYTICS TOPICS
  if (category === "Analytics") {
    if (lowerRequest.match(/push.*analytic|dashboard|date range/)) return "AI Push Analytics";
    if (lowerRequest.match(/attribution|accuracy|discrepancy|cvr|credit.*track/)) return "Attribution & Data Accuracy";
    if (lowerRequest.match(/winback|cart recovery|migration/)) return "Flow-Specific Analytics";
    if (lowerRequest.match(/visibility|can't see|dashboard/)) return "Dashboard Visibility";
    return "Dashboard Visibility"; // default
  }

  // MEDIA TOPICS
  if (category === "Media") {
    if (lowerRequest.match(/video.*ui/)) return "AI Video UI";
    if (lowerRequest.match(/video.*edit/)) return "AI Video Editing";
    if (lowerRequest.match(/video.*generat/)) return "AI Video Generation";
    if (lowerRequest.match(/image/)) return "AI Images";
    return "AI Video"; // default
  }

  // API/DEV TOPICS
  if (category === "API/Dev") {
    if (lowerRequest.match(/cli/)) return "CLI Access";
    if (lowerRequest.match(/security/)) return "Security";
    return "Security"; // default
  }

  // For all other categories, use requestGroup as the topic
  return requestGroup;
}

async function main() {
  console.log('🔄 Fetching records with NULL topics...\n');

  // Fetch all records where topic is NULL
  const records = await sql`
    SELECT id, category, request_group, request, context
    FROM feature_requests
    WHERE topic IS NULL
    ORDER BY category, id
  `;

  console.log(`📊 Found ${records.length} records with NULL topics\n`);

  if (records.length === 0) {
    console.log('✅ No NULL topics found. All records already have topics assigned!');
    return;
  }

  let updated = 0;
  let skipped = 0;
  const updatesByCategory = {};

  for (const record of records) {
    const topic = assignTopic(
      record.category,
      record.request_group,
      record.request,
      record.context
    );

    if (topic) {
      // Update the record
      await sql`
        UPDATE feature_requests
        SET topic = ${topic}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${record.id}
      `;

      // Track statistics
      if (!updatesByCategory[record.category]) {
        updatesByCategory[record.category] = {};
      }
      if (!updatesByCategory[record.category][topic]) {
        updatesByCategory[record.category][topic] = 0;
      }
      updatesByCategory[record.category][topic]++;

      updated++;
      console.log(`✅ ${record.id}: ${record.category} → "${topic}"`);
    } else {
      skipped++;
      console.log(`⏭️  ${record.id}: ${record.category} (no topic rule)`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total records processed: ${records.length}`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped (no rule): ${skipped}`);

  if (Object.keys(updatesByCategory).length > 0) {
    console.log('\n📊 Updates by Category:');
    for (const [category, topics] of Object.entries(updatesByCategory)) {
      console.log(`\n  ${category}:`);
      for (const [topic, count] of Object.entries(topics)) {
        console.log(`    • ${topic}: ${count} records`);
      }
    }
  }

  console.log('\n✅ Done!\n');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
