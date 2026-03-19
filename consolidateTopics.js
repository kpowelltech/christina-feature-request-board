/**
 * Consolidate 114 topics down to ~20 broader categories
 * Maps granular topics to consolidated topics and updates the database
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

// Mapping of old topics to new consolidated topics
const TOPIC_MAPPING = {
  // AI Billing & Pricing - All billing, credits, trials, cancellations
  'AI Billing & Pricing': [
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

  // AI Video Generation - All video creation, editing, UI
  'AI Video Generation': [
    'AI Video',
    'AI Video Editing',
    'AI Video Generation',
    'AI Video UI',
    'AI Video Gallery',
    'ADA AI Video Compliance',
    'ADA Compliant AI Videos',
    'GenAI Video Access',
  ],

  // AI Content & Images - Image generation, content creation, autopilot
  'AI Content & Images': [
    'AI Images',
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

  // AI Tuning & Controls - AI customization, guardrails, timing
  'AI Tuning & Controls': [
    'AI Tuning',
    'AI Brand Language Customization',
    'AI Copy Customization',
    'AI Push Timing Controls',
    'AI Tuning and Instruction Updates',
    'AI Tuning Documentation Update',
  ],

  // Push Performance & Analytics - Push analytics, attribution
  'Push Performance & Analytics': [
    'Push Performance',
    'AI Push Analytics',
    'AI Push Feedback Analysis',
  ],

  // Push Flow Configuration - Cart abandon, browse abandon, winback, welcome
  'Push Flow Configuration': [
    'Abandon Cart Flow',
    'Browse Abandonment Flow',
    'Winback Flow',
    'Welcome Flow',
    'Winback Campaign Scheduling',
  ],

  // Push Timing & Restrictions - Quiet hours, send time controls
  'Push Timing & Restrictions': [
    'Time Restrictions / Options',
    'Push Notification Timing',
  ],

  // Discount & Promo Codes - All discount code features
  'Discount & Promo Codes': [
    'Discount Codes',
    'Discount Code Dropdown Improvements',
    'Streamline Discount Code UX',
    'BOGO Integration Status',
  ],

  // Product Discovery & Personalization - FYF, recommendations
  'Product Discovery & Personalization': [
    'AI Recommendations',
    'AI Segment Targeting',
    'For You Feed',
    'FYF Data Integration',
    'Blog Content in For You Feed',
    'Social Proof FYF Tuning',
    'Dynamic Product Featuring',
    'Klaviyo Profile Data Integration',
  ],

  // Checkout & Payments
  'Checkout & Payments': [
    'Apple Pay',
  ],

  // Reviews & UGC - User generated content, reviews
  'Reviews & UGC': [
    'Product Reviews Widget',
    'User-Generated Content Gallery',
  ],

  // Navigation & Menu
  'Navigation & Menu': [
    'Menu Sync from Website',
  ],

  // Documentation & Support
  'Documentation & Support': [
    'AI Performance Case Studies',
    'AI Support Articles',
    'Beta Program Documentation',
    'Customer Information Request',
    'Information Management System',
  ],

  // Developer & API - CLI, security, integrations
  'Developer & API': [
    'CLI Access',
    'Security',
    'Klaviyo Integration',
  ],

  // Compliance - ADA, SMS
  'Compliance': [
    'SMS Compliance',
  ],

  // Subscriptions & Loyalty
  'Subscriptions & Loyalty': [
    'Subscription-Based Pricing Model',
    'Yotpo Loyalty',
  ],

  // Product Features & UI - General product improvements, UI
  'Product Features & UI': [
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
  ],

  // Merchant Onboarding & Enablement
  'Merchant Onboarding & Enablement': [
    'Merchant Feature Enablement',
    'Merchant Onboarding Continuation',
    'Test AI Features on Merchant',
    'AI Trial Onboarding Friction',
  ],

  // Analytics & Reporting - Flow analytics, conversion tracking
  'Analytics & Reporting': [
    'Attribution & Data Accuracy',
    'Dashboard Visibility',
    'Flow-Specific Analytics',
  ],

  // Integrations & API
  'Integrations': [
    'AM Calendar Integration',
  ],

  // Product Feedback - Merchant feedback, expensive/confusing UI
  'Product Feedback': [
    'Merchant Feedback on AI Features',
    'Expensive, Confusing AI Bundle Interface',
  ],
};

async function consolidateTopics() {
  console.log('🔄 Starting topic consolidation...\n');

  // Create reverse mapping: old topic -> new topic
  const reverseMapping = {};
  for (const [newTopic, oldTopics] of Object.entries(TOPIC_MAPPING)) {
    for (const oldTopic of oldTopics) {
      reverseMapping[oldTopic] = newTopic;
    }
  }

  console.log(`📊 Mapping ${Object.keys(reverseMapping).length} topics to ${Object.keys(TOPIC_MAPPING).length} consolidated topics\n`);

  // Get all current topics
  const currentTopics = await sql`
    SELECT DISTINCT topic, COUNT(*) as count
    FROM feature_requests
    WHERE topic IS NOT NULL
    GROUP BY topic
    ORDER BY topic
  `;

  console.log(`📝 Found ${currentTopics.length} unique topics in database\n`);

  // Track statistics
  let updated = 0;
  let unchanged = 0;
  let unmapped = 0;
  const updatesByNewTopic = {};

  // Update each topic
  for (const { topic, count } of currentTopics) {
    const newTopic = reverseMapping[topic];

    if (newTopic) {
      if (newTopic !== topic) {
        // Update all records with this old topic
        await sql`
          UPDATE feature_requests
          SET topic = ${newTopic}, updated_at = CURRENT_TIMESTAMP
          WHERE topic = ${topic}
        `;

        // Track statistics
        if (!updatesByNewTopic[newTopic]) {
          updatesByNewTopic[newTopic] = 0;
        }
        updatesByNewTopic[newTopic] += parseInt(count);

        updated += parseInt(count);
        console.log(`✅ "${topic}" (${count} requests) → "${newTopic}"`);
      } else {
        unchanged += parseInt(count);
        console.log(`⏭️  "${topic}" (${count} requests) - unchanged`);
      }
    } else {
      unmapped++;
      console.log(`⚠️  "${topic}" (${count} requests) - NO MAPPING FOUND`);
    }
  }

  // Get final topic count
  const finalTopics = await sql`
    SELECT DISTINCT topic, COUNT(*) as count
    FROM feature_requests
    WHERE topic IS NOT NULL
    GROUP BY topic
    ORDER BY topic
  `;

  console.log('\n' + '='.repeat(80));
  console.log('📈 CONSOLIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Original unique topics: ${currentTopics.length}`);
  console.log(`Final unique topics: ${finalTopics.length}`);
  console.log(`Records updated: ${updated}`);
  console.log(`Records unchanged: ${unchanged}`);
  console.log(`Unmapped topics: ${unmapped}`);

  if (Object.keys(updatesByNewTopic).length > 0) {
    console.log('\n📊 Consolidated Topics (sorted by request count):');
    const sorted = Object.entries(updatesByNewTopic).sort((a, b) => b[1] - a[1]);
    for (const [topic, count] of sorted) {
      console.log(`  • ${topic}: ${count} requests`);
    }
  }

  // Show final topic list
  console.log('\n📋 All Final Topics:');
  for (const { topic, count } of finalTopics) {
    console.log(`  • ${topic} (${count} requests)`);
  }

  console.log('\n✅ Consolidation complete!\n');
}

consolidateTopics().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
