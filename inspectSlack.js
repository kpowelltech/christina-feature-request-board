/**
 * inspectSlack.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Inspect Slack messages without writing to database
 *
 * Usage:
 *   node inspectSlack.js                  # show last 10 from both channels
 *   node inspectSlack.js --channel product # show from product channel only
 *   node inspectSlack.js --channel ai     # show from ai channel only
 *   node inspectSlack.js --limit 20       # show last 20 messages
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";

const SLACK_API_BASE = "https://slack.com/api";

const CHANNELS = {
  product: {
    id: process.env.PRODUCT_CHANNEL_ID || "REPLACE_WITH_CHANNEL_ID",
    name: "#product",
  },
  ai: {
    id: process.env.AI_FEEDBACK_CHANNEL_ID || "REPLACE_WITH_CHANNEL_ID",
    name: "#ai-feedback",
  },
};

async function slackFetch(method, params = {}) {
  const url = new URL(`${SLACK_API_BASE}/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });

  if (!res.ok) throw new Error(`Slack ${method} HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack API error: ${json.error} (method=${method})`);
  return json;
}

async function fetchMessages(channelId, limit = 10) {
  const data = await slackFetch("conversations.history", {
    channel: channelId,
    limit: limit,
  });

  return (data.messages || []).filter(
    (m) => m.type === "message" && !m.subtype && m.text?.trim()
  );
}

async function resolveUsername(userId) {
  try {
    const data = await slackFetch("users.info", { user: userId });
    return data.user?.profile?.display_name || data.user?.real_name || userId;
  } catch {
    return userId;
  }
}

function formatTimestamp(ts) {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toISOString().replace('T', ' ').split('.')[0];
}

async function inspectChannel(channelKey, limit) {
  const channel = CHANNELS[channelKey];
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📱 ${channel.name} (${channel.id})`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const messages = await fetchMessages(channel.id, limit);
    console.log(`Found ${messages.length} messages\n`);

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const username = await resolveUsername(msg.user);
      const timestamp = formatTimestamp(msg.ts);

      console.log(`\n${'-'.repeat(80)}`);
      console.log(`Message #${i + 1}`);
      console.log(`${'-'.repeat(80)}`);
      console.log(`👤 User:      ${username} (${msg.user})`);
      console.log(`📅 Timestamp: ${timestamp}`);
      console.log(`🔑 Slack TS:  ${msg.ts}`);
      console.log(`\n💬 Message:`);
      console.log(`${'-'.repeat(80)}`);
      console.log(msg.text);
      console.log(`${'-'.repeat(80)}`);
    }

    console.log(`\n✅ Inspected ${messages.length} messages from ${channel.name}\n`);
  } catch (err) {
    console.error(`❌ Error fetching ${channel.name}:`, err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const channelArg = args.find((a, i) => args[i - 1] === "--channel");
  const limitArg = args.find((a, i) => args[i - 1] === "--limit");

  const channelKeys = channelArg ? [channelArg] : Object.keys(CHANNELS);
  const limit = limitArg ? parseInt(limitArg) : 10;

  console.log(`\n🔍 Slack Message Inspector`);
  console.log(`📊 Limit: ${limit} messages per channel\n`);

  for (const key of channelKeys) {
    await inspectChannel(key, limit);
  }

  console.log(`${'='.repeat(80)}\n`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
