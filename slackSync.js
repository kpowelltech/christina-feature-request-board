/**
 * slackSync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend sync utility for Tapcart Feature Request Board
 *
 * Polls two Slack channels:
 *   • #product      → feature/bug requests from the CS/Solutions team
 *   • #ai-feedback  → AI Pro feature feedback
 *
 * Each raw Slack message is normalized into the shared RequestEntry schema
 * (matching requests_data.json) using a lightweight Claude-powered parser so
 * free-form messages become structured records.
 *
 * Usage:
 *   node slackSync.js                  # one-shot sync, prints JSON diff
 *   node slackSync.js --watch          # polls every POLL_INTERVAL_MS
 *   node slackSync.js --channel ai     # only sync #ai-feedback
 *   node slackSync.js --channel product # only sync #product
 *
 * Environment variables (set in .env):
 *   SLACK_BOT_TOKEN      – Bot token with channels:history scope
 *   ANTHROPIC_API_KEY    – For the Claude-powered message parser
 *   PRODUCT_CHANNEL_ID   – Slack channel ID for #product
 *   AI_FEEDBACK_CHANNEL_ID – Slack channel ID for #ai-feedback
 *   DATA_DIR             – Directory to write output JSON files (default: ./data)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

// ─── Config ───────────────────────────────────────────────────────────────────
const SLACK_API_BASE    = "https://slack.com/api";
const POLL_INTERVAL_MS  = 5 * 60 * 1000; // 5 minutes
const MAX_MESSAGES      = 200;            // per sync per channel
const DATA_DIR          = process.env.DATA_DIR || "./data";

const CHANNELS = {
  product: {
    id:       process.env.PRODUCT_CHANNEL_ID    || "REPLACE_WITH_CHANNEL_ID",
    name:     "#product",
    outFile:  "requests_data.json",
    idPrefix: "prod",
  },
  ai: {
    id:       process.env.AI_FEEDBACK_CHANNEL_ID || "REPLACE_WITH_CHANNEL_ID",
    name:     "#ai-feedback",
    outFile:  "ai_feedback_data.json",
    idPrefix: "ai",
  },
};

// ─── Shared schema ────────────────────────────────────────────────────────────
/**
 * @typedef {Object} RequestEntry
 * @property {string|number} id
 * @property {string}  merchant
 * @property {number}  mrr
 * @property {number}  arr
 * @property {"feature"|"integration"} type
 * @property {string}  category
 * @property {string}  requestGroup
 * @property {string}  request
 * @property {string|null} context
 * @property {string}  submittedBy
 * @property {string}  date          ISO YYYY-MM-DD
 * @property {"pending"|"sent_to_slack"|"asana_created"} status
 * @property {string|null} asanaId
 * @property {string}  slackTs       Slack message timestamp (dedup key)
 * @property {string}  slackUser     Slack user ID of the poster
 */

// ─── Slack helpers ────────────────────────────────────────────────────────────
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

async function fetchChannelHistory(channelId, oldest = null) {
  const params = { channel: channelId, limit: MAX_MESSAGES };
  if (oldest) params.oldest = oldest;

  const data = await slackFetch("conversations.history", params);
  // Filter out bot/system messages, only real user messages
  return (data.messages || []).filter(m => m.type === "message" && !m.subtype && m.text?.trim());
}

async function resolveUsername(userId) {
  try {
    const data = await slackFetch("users.info", { user: userId });
    return data.user?.profile?.display_name || data.user?.real_name || userId;
  } catch {
    return userId;
  }
}

// ─── Claude-powered message parser ───────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PARSE_SYSTEM_PROMPT = `You are a data extraction assistant for a mobile commerce platform (Tapcart).
You receive raw Slack messages from internal team channels and must extract structured product/feature request data.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "merchant": "string | 'Unknown'",
  "type": "feature | integration",
  "category": "one of: Cart, Checkout, PDP, Search, Navigation, Push Notifications, Loyalty, Reviews, Analytics, API/Dev, Product, Wishlist, Integrations, Promotions, Messaging, Media, Accessibility, Billing, Compliance, Documentation, Personalization, Subscriptions",
  "requestGroup": "2-6 word group label summarizing the topic (used for deduplication grouping)",
  "request": "one-sentence summary of the request or bug",
  "context": "additional detail from the message, or null",
  "submittedBy": "name of person submitting if mentioned, else 'Unknown'"
}

Rules:
- type="integration" if the request involves a third-party tool (Klaviyo, Yotpo, AppsFlyer, Recharge, etc.)
- type="feature" for native app features, bugs, and UX improvements
- requestGroup must be concise and reusable — similar requests from different merchants should get the same requestGroup
- context should preserve useful technical details, trim greetings/noise
- If the message is clearly not a product request (e.g. just a reaction, link, or off-topic), return {"skip": true}`;

async function parseMessageWithClaude(text, channelName) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: PARSE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Channel: ${channelName}\n\nMessage:\n${text}`,
      },
    ],
  });

  const raw = response.content[0]?.text?.trim() || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    console.warn("[parser] Claude returned non-JSON:", raw.slice(0, 120));
    return { skip: true };
  }
}

// ─── Sync logic ───────────────────────────────────────────────────────────────
function loadExisting(outPath) {
  try {
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch {
    return [];
  }
}

function tsToDate(ts) {
  return new Date(parseFloat(ts) * 1000).toISOString().split("T")[0];
}

/**
 * Sync a single channel.
 * Returns { added: RequestEntry[], skipped: number, errors: number }
 */
async function syncChannel(channelKey) {
  const channel = CHANNELS[channelKey];
  if (!channel) throw new Error(`Unknown channel key: ${channelKey}`);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, channel.outFile);
  const existing = loadExisting(outPath);

  // Build a set of already-synced Slack timestamps for dedup
  const existingTs = new Set(existing.map(e => e.slackTs).filter(Boolean));
  const latestTs   = existing.reduce((m, e) => {
    const n = parseFloat(e.slackTs || 0);
    return n > m ? n : m;
  }, 0);

  console.log(`\n[sync] ${channel.name} — fetching messages since ${latestTs ? new Date(latestTs * 1000).toISOString() : "beginning"}...`);

  let messages;
  try {
    messages = await fetchChannelHistory(channel.id, latestTs || null);
  } catch (err) {
    console.error(`[sync] Failed to fetch ${channel.name}:`, err.message);
    return { added: [], skipped: 0, errors: 1 };
  }

  console.log(`[sync] ${messages.length} new messages found`);

  const added    = [];
  let   skipped  = 0;
  let   errors   = 0;
  let   idCounter = existing.length + 1;

  for (const msg of messages) {
    if (existingTs.has(msg.ts)) { skipped++; continue; }

    let parsed;
    try {
      parsed = await parseMessageWithClaude(msg.text, channel.name);
    } catch (err) {
      console.error(`[parser] Error on ts=${msg.ts}:`, err.message);
      errors++;
      continue;
    }

    if (parsed.skip) { skipped++; continue; }

    const username = await resolveUsername(msg.user);

    /** @type {RequestEntry} */
    const entry = {
      id:           `${channel.idPrefix}-${String(idCounter++).padStart(4, "0")}`,
      merchant:     parsed.merchant    || "Unknown",
      mrr:          0,
      arr:          0,
      type:         parsed.type        || "feature",
      category:     parsed.category    || "Product",
      requestGroup: parsed.requestGroup|| "Uncategorized",
      request:      parsed.request     || msg.text.slice(0, 120),
      context:      parsed.context     || null,
      submittedBy:  parsed.submittedBy !== "Unknown" ? parsed.submittedBy : username,
      date:         tsToDate(msg.ts),
      status:       "pending",
      asanaId:      null,
      slackTs:      msg.ts,
      slackUser:    msg.user,
    };

    added.push(entry);
    console.log(`  + [${entry.id}] ${entry.requestGroup} — ${entry.request.slice(0, 70)}`);
  }

  if (added.length > 0) {
    const updated = [...existing, ...added];
    fs.writeFileSync(outPath, JSON.stringify(updated, null, 2), "utf8");
    console.log(`[sync] Wrote ${updated.length} total entries to ${outPath}`);
  } else {
    console.log(`[sync] No new entries — ${outPath} unchanged`);
  }

  return { added, skipped, errors };
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────
async function main() {
  const args       = process.argv.slice(2);
  const watchMode  = args.includes("--watch");
  const channelArg = args.find((a, i) => args[i - 1] === "--channel");
  const channelKeys = channelArg ? [channelArg] : Object.keys(CHANNELS);

  const runOnce = async () => {
    const results = {};
    for (const key of channelKeys) {
      results[key] = await syncChannel(key);
    }
    const totalAdded = Object.values(results).reduce((s, r) => s + r.added.length, 0);
    console.log(`\n[sync] Done — ${totalAdded} entries added across ${channelKeys.length} channel(s)`);
    return results;
  };

  if (watchMode) {
    console.log(`[watch] Polling every ${POLL_INTERVAL_MS / 1000}s — Ctrl+C to stop`);
    await runOnce();
    setInterval(runOnce, POLL_INTERVAL_MS);
  } else {
    await runOnce();
    process.exit(0);
  }
}

main().catch(err => {
  console.error("[fatal]", err);
  process.exit(1);
});

// ─── Exports (for use as a module in Express/Next.js etc.) ────────────────────
export { syncChannel, parseMessageWithClaude, fetchChannelHistory, CHANNELS };
