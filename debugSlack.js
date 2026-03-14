import "dotenv/config";

const SLACK_API_BASE = "https://slack.com/api";
const AI_CHANNEL = process.env.AI_FEEDBACK_CHANNEL_ID;

async function slackFetch(method, params = {}) {
  const url = new URL(`${SLACK_API_BASE}/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });

  if (!res.ok) throw new Error(`Slack ${method} HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack API error: ${json.error}`);
  return json;
}

const data = await slackFetch("conversations.history", {
  channel: AI_CHANNEL,
  limit: 20,
});

console.log(`\nFound ${data.messages.length} total messages\n`);

data.messages.forEach((msg, i) => {
  console.log(`Message ${i + 1}:`);
  console.log(`  Type: ${msg.type}`);
  console.log(`  Subtype: ${msg.subtype || 'none'}`);
  console.log(`  Has text: ${!!msg.text}`);
  console.log(`  Text length: ${msg.text?.length || 0}`);
  console.log(`  User: ${msg.user || 'N/A'}`);
  console.log(`  Bot ID: ${msg.bot_id || 'N/A'}`);
  if (msg.text) {
    console.log(`  Preview: ${msg.text.slice(0, 60)}...`);
  }
  console.log();
});
