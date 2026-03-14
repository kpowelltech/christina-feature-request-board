/**
 * Debug script to show what messages are being filtered out
 */

import 'dotenv/config';

const SLACK_API_BASE = "https://slack.com/api";
const CHANNEL_ID = process.env.AI_FEEDBACK_CHANNEL_ID;

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

async function analyzeMessages() {
  console.log('🔍 Analyzing Slack Messages\n');

  const data = await slackFetch("conversations.history", {
    channel: CHANNEL_ID,
    limit: 200
  });

  const allMessages = data.messages || [];
  console.log(`Total messages fetched: ${allMessages.length}\n`);

  // Categorize messages
  const categories = {
    validMessages: [],
    noText: [],
    wrongType: [],
    filteredSubtype: []
  };

  allMessages.forEach(msg => {
    // Check our filter logic
    const hasText = msg.text?.trim();
    const isMessage = msg.type === "message";
    const hasValidSubtype = !msg.subtype || msg.subtype === "workflow_message" || msg.subtype === "bot_message";

    if (!isMessage) {
      categories.wrongType.push(msg);
    } else if (!hasText) {
      categories.noText.push(msg);
    } else if (!hasValidSubtype) {
      categories.filteredSubtype.push(msg);
    } else {
      categories.validMessages.push(msg);
    }
  });

  console.log('Message breakdown:');
  console.log(`  ✅ Valid messages (will sync): ${categories.validMessages.length}`);
  console.log(`  ❌ No text content: ${categories.noText.length}`);
  console.log(`  ❌ Wrong type (not "message"): ${categories.wrongType.length}`);
  console.log(`  ❌ Filtered subtype: ${categories.filteredSubtype.length}`);

  if (categories.filteredSubtype.length > 0) {
    console.log('\nFiltered subtypes:');
    const subtypeCounts = {};
    categories.filteredSubtype.forEach(msg => {
      const subtype = msg.subtype || 'none';
      subtypeCounts[subtype] = (subtypeCounts[subtype] || 0) + 1;
    });
    Object.entries(subtypeCounts).forEach(([subtype, count]) => {
      console.log(`  ${subtype}: ${count}`);
    });
  }

  if (categories.noText.length > 0 && categories.noText.length < 10) {
    console.log('\nMessages without text (sample):');
    categories.noText.slice(0, 5).forEach(msg => {
      console.log(`  Type: ${msg.type}, Subtype: ${msg.subtype || 'none'}, Has files: ${!!msg.files}, Has attachments: ${!!msg.attachments}`);
    });
  }

  console.log(`\n✅ Expected to sync: ${categories.validMessages.length} messages`);
}

analyzeMessages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
