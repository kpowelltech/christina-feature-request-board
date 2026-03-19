/**
 * Remap all topics to 7 predefined categories
 * Uses AI to intelligently map ambiguous cases based on request text
 */

import { neon } from '@neondatabase/serverless';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 7 predefined topic categories
const PREDEFINED_TOPICS = [
  'AI Push Flows',
  'For You Feed',
  'AI Content & Video Generation',
  'AI Autopilot',
  'AI Billing & Pricing',
  'Analytics & Reporting',
  'Other'
];

// Clear mappings for existing topics to new predefined topics
const TOPIC_MAPPING = {
  // AI Push Flows - All push notification flows, timing, controls
  'AI Push Flows': [
    'AI Push Flows',
    'Push Flow Configuration',
    'Push Timing & Restrictions',
    'Welcome Flow',
    'AI Tuning & Controls',
    'Abandon Cart Flow',
    'Browse Abandonment Flow',
    'Winback Flow',
    'Winback Campaign Scheduling',
    'Time Restrictions / Options',
    'Push Notification Timing',
    'AI Tuning',
    'AI Brand Language Customization',
    'AI Copy Customization',
    'AI Push Timing Controls',
    'AI Tuning and Instruction Updates',
    'AI Tuning Documentation Update',
  ],

  // For You Feed - Product discovery and personalization
  'For You Feed': [
    'Product Discovery & Personalization',
    'For You Feed',
    'AI Recommendations',
    'AI Segment Targeting',
    'FYF Data Integration',
    'Blog Content in For You Feed',
    'Social Proof FYF Tuning',
    'Dynamic Product Featuring',
    'Klaviyo Profile Data Integration',
  ],

  // AI Content & Video Generation - All media, video, image generation
  'AI Content & Video Generation': [
    'AI Content & Video Generation',
    'AI Video Generation',
    'AI Video',
    'AI Video Editing',
    'AI Video UI',
    'AI Images',
    'AI Content & Images',
    'AI Video Gallery',
    'ADA AI Video Compliance',
    'ADA Compliant AI Videos',
    'GenAI Video Access',
    'AI Autopilot Block Builder',
    'AI-Generated App Blocks',
    'Autopilot Block Building Feature',
    'Content Block Creation',
    'Asset Creation Tool',
    'Automatic Image Prefilling',
    'Generative AI Art Creation',
    'Image-Content Mismatch',
    'AI Autopilot Caption Accuracy',
  ],

  // AI Autopilot - Empty for future use
  'AI Autopilot': [
    // Reserved for future requests
  ],

  // AI Billing & Pricing - All billing, credits, trials
  'AI Billing & Pricing': [
    'AI Billing & Pricing',
    'AI Billing Assignment',
    'AI Bundle Reporting',
    'AI Credits Billing Issue',
    'AI Features Pricing',
    'AI Pro Beta Cancellation',
    'AI Pro Billing Communication',
    'AI Pro Remove Button',
    'AI Pro billing issue',
    'AI Product Removal',
    'AI Trial Extension',
    'AI-Free Subscription Tier',
    'Add-on Plan Availability',
    'Billing Date Display',
    'Bulk Credit Pricing',
    'Cancel AI Beta Billing',
    'Credit Addition Request',
    'Credit Usage Display',
    'Credit Usage Tracking',
    'Disable AI Pro Beta',
    'Trial Extension',
    'Trial Extension Request',
    'Credit Usage Hover Details',
    'AI Pro Bundle Enhancements',
    'AI Suite Bundle Testing',
  ],

  // Analytics & Reporting - All analytics, dashboards, attribution
  'Analytics & Reporting': [
    'Analytics & Reporting',
    'Push Performance & Analytics',
    'Attribution & Data Accuracy',
    'Dashboard Visibility',
    'Flow-Specific Analytics',
    'Push Performance',
    'AI Push Analytics',
    'AI Push Feedback Analysis',
  ],

  // Other - Everything else
  'Other': [
    'Security',
    'Subscriptions & Loyalty',
    'Navigation & Menu',
    'Documentation & Support',
    'Merchant Onboarding & Enablement',
    'Product Features & UI',
    'Product Feedback',
    'Discount & Promo Codes',
    'Discount Codes',
    'Reviews & UGC',
    'Other',
    'CLI Access',
    'Klaviyo Integration',
    'SMS Compliance',
    'Subscription-Based Pricing Model',
    'Yotpo Loyalty',
    'Menu Sync from Website',
    'AI Performance Case Studies',
    'AI Support Articles',
    'Beta Program Documentation',
    'Customer Information Request',
    'Information Management System',
    'Developer & API',
    'Compliance',
    'Integrations',
    'Checkout & Payments',
    'Apple Pay',
    'Product Reviews Widget',
    'User-Generated Content Gallery',
    'Discount Code Dropdown Improvements',
    'Streamline Discount Code UX',
    'BOGO Integration Status',
    'AI Feature Availability',
    'AI Font Styling',
    'AI Page Builder',
    'AI Scenes Enablement',
    'AI Scenes Optimization',
    'Ada Field Enhancement',
    'Carousel Display',
    'Content Curation from AI Dashboard',
    'Content Label Update',
    'Existing AI Editor Functionality',
    'Fire Feature',
    'Follow Up Logic',
    'GA Release Announcement',
    'General Issue Resolution',
    'Headless Website Compatibility',
    'Investigate Suspected Bug',
    'New Feature Request',
    'Scenes Feature Availability',
    'Status Update',
    'Backlog Development Prioritization',
    'Back-in-Stock Event Tracking',
    'Positive Feedback on Gemini AI',
    'Merchant Feature Enablement',
    'Merchant Onboarding Continuation',
    'Test AI Features on Merchant',
    'AI Trial Onboarding Friction',
    'AM Calendar Integration',
    'Merchant Feedback on AI Features',
    'Expensive, Confusing AI Bundle Interface',
  ],
};

// Use AI to assign topic for ambiguous cases
async function assignTopicWithAI(record) {
  const prompt = `Analyze this feature request and assign it to ONE of these predefined topics:

1. AI Push Flows - Push notifications, flows (cart abandon, browse abandon, winback, welcome), timing, AI tuning
2. For You Feed - Product discovery, personalization, recommendations, FYF
3. AI Content & Video Generation - Video creation, image generation, AI-generated content
4. AI Autopilot - Automated features, autopilot capabilities
5. AI Billing & Pricing - Billing, credits, trials, pricing
6. Analytics & Reporting - Analytics, dashboards, attribution, reporting, performance metrics
7. Other - Everything else (security, documentation, integrations, compliance, etc.)

Category: ${record.category}
Current Topic: ${record.topic || 'NULL'}
Request: ${record.request}
${record.context ? `Context: ${record.context}` : ''}

Return ONLY the topic name exactly as written above (e.g., "AI Push Flows", "Analytics & Reporting", "Other").`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 20,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const topic = message.content[0].text.trim();

    // Validate that AI returned one of our predefined topics
    if (PREDEFINED_TOPICS.includes(topic)) {
      return {
        id: record.id,
        oldTopic: record.topic,
        newTopic: topic,
        success: true,
        method: 'AI'
      };
    } else {
      // If AI returned something unexpected, default to Other
      console.log(`⚠️  AI returned unexpected topic "${topic}" for ${record.id}, defaulting to "Other"`);
      return {
        id: record.id,
        oldTopic: record.topic,
        newTopic: 'Other',
        success: true,
        method: 'AI-fallback'
      };
    }
  } catch (error) {
    console.error(`❌ AI failed for ${record.id}: ${error.message}`);
    return {
      id: record.id,
      oldTopic: record.topic,
      newTopic: 'Other',
      success: true,
      method: 'error-fallback',
      error: error.message
    };
  }
}

// Batch AI requests to respect rate limits
async function assignTopicsInBatch(records, batchSize = 4) {
  const results = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`\n📦 AI Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);

    const batchPromises = batch.map(record => assignTopicWithAI(record));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Wait between batches to respect rate limit
    if (i + batchSize < records.length) {
      console.log('⏳ Waiting 15 seconds...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }

  return results;
}

async function remapTopics() {
  console.log('🔄 Starting topic remapping to 7 predefined categories...\n');
  console.log('📋 Predefined Topics:');
  PREDEFINED_TOPICS.forEach((topic, i) => console.log(`  ${i + 1}. ${topic}`));
  console.log('');

  // Create reverse mapping: old topic -> new topic
  const reverseMapping = {};
  for (const [newTopic, oldTopics] of Object.entries(TOPIC_MAPPING)) {
    for (const oldTopic of oldTopics) {
      reverseMapping[oldTopic] = newTopic;
    }
  }

  console.log(`📊 Direct mappings configured: ${Object.keys(reverseMapping).length} old topics → ${Object.keys(TOPIC_MAPPING).length} new topics\n`);

  // Get all records (including NULL topics)
  const allRecords = await sql`
    SELECT id, category, topic, request, context
    FROM feature_requests
    WHERE deleted_at IS NULL
    ORDER BY topic, id
  `;

  console.log(`📝 Found ${allRecords.length} total records in database\n`);

  // Separate records into direct mapping vs AI-needed
  const directMappingRecords = [];
  const aiNeededRecords = [];
  const nullTopicRecords = [];

  for (const record of allRecords) {
    if (record.topic === null) {
      nullTopicRecords.push(record);
    } else if (reverseMapping[record.topic]) {
      directMappingRecords.push(record);
    } else {
      aiNeededRecords.push(record);
    }
  }

  console.log(`📊 Record breakdown:`);
  console.log(`  • Direct mappings: ${directMappingRecords.length}`);
  console.log(`  • Need AI analysis: ${aiNeededRecords.length}`);
  console.log(`  • NULL topics (map to "Other"): ${nullTopicRecords.length}`);
  console.log('');

  const updateStats = {
    direct: 0,
    ai: 0,
    null: 0,
    byNewTopic: {}
  };

  // Process direct mappings
  if (directMappingRecords.length > 0) {
    console.log('📦 Processing direct mappings...\n');

    for (const record of directMappingRecords) {
      const oldTopic = record.topic;
      const newTopic = reverseMapping[oldTopic];

      if (oldTopic !== newTopic) {
        await sql`
          UPDATE feature_requests
          SET topic = ${newTopic}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${record.id}
        `;

        if (!updateStats.byNewTopic[newTopic]) {
          updateStats.byNewTopic[newTopic] = 0;
        }
        updateStats.byNewTopic[newTopic]++;
        updateStats.direct++;

        console.log(`✅ "${oldTopic}" → "${newTopic}" (${record.id})`);
      }
    }
  }

  // Process NULL topics (map to "Other")
  if (nullTopicRecords.length > 0) {
    console.log('\n📦 Processing NULL topics (mapping to "Other")...\n');

    for (const record of nullTopicRecords) {
      await sql`
        UPDATE feature_requests
        SET topic = 'Other', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${record.id}
      `;

      if (!updateStats.byNewTopic['Other']) {
        updateStats.byNewTopic['Other'] = 0;
      }
      updateStats.byNewTopic['Other']++;
      updateStats.null++;

      console.log(`✅ NULL → "Other" (${record.id})`);
    }
  }

  // Process AI-needed records
  if (aiNeededRecords.length > 0) {
    console.log(`\n🤖 Using Claude AI to analyze ${aiNeededRecords.length} ambiguous topics...\n`);

    const aiResults = await assignTopicsInBatch(aiNeededRecords);

    for (const result of aiResults) {
      if (result.success && result.oldTopic !== result.newTopic) {
        await sql`
          UPDATE feature_requests
          SET topic = ${result.newTopic}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${result.id}
        `;

        if (!updateStats.byNewTopic[result.newTopic]) {
          updateStats.byNewTopic[result.newTopic] = 0;
        }
        updateStats.byNewTopic[result.newTopic]++;
        updateStats.ai++;

        console.log(`✅ "${result.oldTopic}" → "${result.newTopic}" (${result.id}) [${result.method}]`);
      }
    }
  }

  // Get final topic distribution
  const finalTopics = await sql`
    SELECT topic, COUNT(*) as count
    FROM feature_requests
    WHERE deleted_at IS NULL
    GROUP BY topic
    ORDER BY count DESC, topic
  `;

  console.log('\n' + '='.repeat(80));
  console.log('📈 REMAPPING SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total records processed: ${allRecords.length}`);
  console.log(`Direct mappings: ${updateStats.direct}`);
  console.log(`AI mappings: ${updateStats.ai}`);
  console.log(`NULL → Other: ${updateStats.null}`);
  console.log(`Total updated: ${updateStats.direct + updateStats.ai + updateStats.null}`);

  console.log('\n📊 Final Topic Distribution:');
  for (const { topic, count } of finalTopics) {
    const icon = topic === null ? '⚠️' : '✅';
    console.log(`  ${icon} ${topic || 'NULL'}: ${count} requests`);
  }

  if (Object.keys(updateStats.byNewTopic).length > 0) {
    console.log('\n📊 Updates by New Topic:');
    const sorted = Object.entries(updateStats.byNewTopic).sort((a, b) => b[1] - a[1]);
    for (const [topic, count] of sorted) {
      console.log(`  • ${topic}: ${count} records updated`);
    }
  }

  console.log('\n✅ Remapping complete!\n');
}

remapTopics().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
