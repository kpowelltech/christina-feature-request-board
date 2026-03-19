/**
 * Intelligently assign topics to all NULL topic values using Claude AI
 * Reads request content and assigns meaningful topics
 */

import { neon } from '@neondatabase/serverless';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Batch requests to avoid rate limits (5 per minute max)
async function assignTopicsInBatch(records, batchSize = 4) {
  const results = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);

    const batchPromises = batch.map(record => assignTopicWithAI(record));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Wait 1 minute between batches to respect rate limit (5 per minute)
    if (i + batchSize < records.length) {
      console.log('⏳ Waiting 60 seconds to respect rate limit...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }

  return results;
}

async function assignTopicWithAI(record) {
  const prompt = `Analyze this feature request and assign a concise, descriptive topic (2-5 words).

Category: ${record.category}
Request: ${record.request}
${record.context ? `Context: ${record.context}` : ''}

Rules:
- Topic should be specific and descriptive
- Use title case (e.g., "Apple Pay Integration", "Push Notification Timing")
- Should group similar requests together
- Max 5 words
- Focus on the core feature/issue being requested

Return ONLY the topic name, nothing else.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 30,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const topic = message.content[0].text.trim();
    console.log(`✅ ${record.id}: "${topic}"`);

    return {
      id: record.id,
      category: record.category,
      topic,
      success: true
    };
  } catch (error) {
    console.error(`❌ ${record.id}: ${error.message}`);
    return {
      id: record.id,
      category: record.category,
      topic: record.request_group, // Fallback
      success: false,
      error: error.message
    };
  }
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

  console.log('🤖 Using Claude AI to analyze and assign topics...\n');

  // Process in batches
  const results = await assignTopicsInBatch(records);

  console.log('\n📝 Updating database...\n');

  let updated = 0;
  let failed = 0;
  const updatesByCategory = {};

  for (const result of results) {
    if (result.success) {
      // Update the record
      await sql`
        UPDATE feature_requests
        SET topic = ${result.topic}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${result.id}
      `;

      // Track statistics
      if (!updatesByCategory[result.category]) {
        updatesByCategory[result.category] = {};
      }
      if (!updatesByCategory[result.category][result.topic]) {
        updatesByCategory[result.category][result.topic] = 0;
      }
      updatesByCategory[result.category][result.topic]++;

      updated++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total records processed: ${records.length}`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);

  if (Object.keys(updatesByCategory).length > 0) {
    console.log('\n📊 Topics Assigned by Category:');
    for (const [category, topics] of Object.entries(updatesByCategory).sort()) {
      console.log(`\n  ${category}:`);
      const sortedTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]);
      for (const [topic, count] of sortedTopics) {
        console.log(`    • ${topic}: ${count} record${count > 1 ? 's' : ''}`);
      }
    }
  }

  console.log('\n✅ Done!\n');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
