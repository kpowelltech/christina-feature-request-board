/**
 * previewSync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Preview what will be synced to database WITHOUT actually writing
 *
 * Usage:
 *   node previewSync.js                  # preview both channels (5 msgs each)
 *   node previewSync.js --channel product # preview product only
 *   node previewSync.js --limit 10       # preview 10 messages per channel
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

// ─── Config ───────────────────────────────────────────────────────────────────
const SLACK_API_BASE = "https://slack.com/api";
const USE_CLAUDE = !!process.env.ANTHROPIC_API_KEY;

const CHANNELS = {
  product: {
    id: process.env.PRODUCT_CHANNEL_ID || "REPLACE_WITH_CHANNEL_ID",
    name: "#product",
    idPrefix: "prod",
    channel: "product",
  },
  ai: {
    id: process.env.AI_FEEDBACK_CHANNEL_ID || "REPLACE_WITH_CHANNEL_ID",
    name: "#ai-feedback",
    idPrefix: "ai",
    channel: "ai",
  },
};

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

async function fetchMessages(channelId, limit) {
  const data = await slackFetch("conversations.history", {
    channel: channelId,
    limit: limit,
  });

  // Include regular messages, workflow messages, and bot messages
  return (data.messages || []).filter(
    (m) => m.type === "message" && (!m.subtype || m.subtype === "workflow_message" || m.subtype === "bot_message") && m.text?.trim()
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

// ─── Simple fallback parser ──────────────────────────────────────────────────
function simpleParse(text, channelName, isWorkflow = false) {
  const lowerText = text.toLowerCase();

  if (isWorkflow) {
    // Parse workflow format: *Field Name*\nValue
    const merchant = text.match(/\*Merchant Name\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || "Unknown";
    const appId = text.match(/\*App ID\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;
    const mrr = parseInt(text.match(/\*MRR\*\s*\n\s*(\d+)/i)?.[1] || "0");
    const workflowCategory = text.match(/\*Category\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim();
    const feedback = text.match(/\*Feedback\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || "";

    // Map workflow category to standardized request group
    const categoryMap = {
      "AI Push Flow": "Push Notifications",
      "AI Content": "Product",
      "AI Winback": "Push Notifications",
    };
    const requestGroup = categoryMap[workflowCategory] || workflowCategory || "Product";

    // Create context summary
    const context = feedback ? `${workflowCategory || "Product"} feedback: ${feedback}` : null;

    return {
      merchant,
      appId,
      mrr,
      type: "feature",
      category: workflowCategory || "Product",  // Keep raw workflow category
      requestGroup,  // Mapped/standardized group
      context,  // Summary of the feedback
      submittedBy: "Unknown",
    };
  }

  // Standard free-form message parsing
  let merchant = "Unknown";
  const merchantMatch = text.match(/merchant[:\s]+([^\n,\.]+)/i);
  if (merchantMatch) {
    merchant = merchantMatch[1].trim();
  }

  const integrationKeywords = ["klaviyo", "yotpo", "recharge", "appsflyer", "integration", "third-party", "plugin"];
  const type = integrationKeywords.some(kw => lowerText.includes(kw)) ? "integration" : "feature";

  let category = "Product";
  const categoryKeywords = {
    "Cart": ["cart", "bag", "add to cart"],
    "Checkout": ["checkout", "payment", "purchase"],
    "PDP": ["pdp", "product detail", "product page"],
    "Search": ["search", "find", "filter"],
    "Push Notifications": ["push", "notification", "alert"],
    "Loyalty": ["loyalty", "rewards", "points"],
    "Analytics": ["analytics", "tracking", "data"],
    "API/Dev": ["api", "webhook", "developer", "sdk"],
    "Integrations": ["integration", "connect", "sync"],
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      category = cat;
      break;
    }
  }

  return {
    merchant,
    appId: null,
    mrr: 0,
    type,
    category,
    requestGroup: category,
    context: null,  // Will be filled by Claude or remain null
    submittedBy: "Unknown",
  };
}

// ─── Claude parser ───────────────────────────────────────────────────────────
const anthropic = USE_CLAUDE ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const PARSE_SYSTEM_PROMPT = `You are a data extraction assistant for a mobile commerce platform (Tapcart).
You receive raw Slack messages from internal team channels and must extract structured product/feature request data.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "merchant": "string | 'Unknown'",
  "appId": "string | null",
  "mrr": "number (monthly recurring revenue)",
  "type": "feature | integration",
  "category": "one of: Cart, Checkout, PDP, Search, Navigation, Push Notifications, Loyalty, Reviews, Analytics, API/Dev, Product, Wishlist, Integrations, Promotions, Messaging, Media, Accessibility, Billing, Compliance, Documentation, Personalization, Subscriptions",
  "requestGroup": "2-6 word group label summarizing the topic (used for deduplication grouping)",
  "context": "one-sentence summary or context of the request (what they want and why), or null",
  "submittedBy": "name of person submitting if mentioned, else 'Unknown'"
}

Rules:
- type="integration" if the request involves a third-party tool (Klaviyo, Yotpo, AppsFlyer, Recharge, etc.)
- type="feature" for native app features, bugs, and UX improvements
- requestGroup must be concise and reusable — similar requests from different merchants should get the same requestGroup
- context should be a helpful one-sentence summary that captures the essence of the request
- If the message is clearly not a product request (e.g. just a reaction, link, or off-topic), return {"skip": true}`;

async function parseMessageWithClaude(text, channelName, isWorkflow = false) {
  // For workflow messages, always use simple parser (it's already perfect for structured data)
  if (isWorkflow) {
    return { parsed: simpleParse(text, channelName, isWorkflow), parser: "workflow" };
  }

  if (!USE_CLAUDE) {
    return { parsed: simpleParse(text, channelName, isWorkflow), parser: "simple" };
  }

  try {
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

    let raw = response.content[0]?.text?.trim() || "{}";

    // Strip markdown code block wrappers if present
    if (raw.startsWith("```json")) {
      raw = raw.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (raw.startsWith("```")) {
      raw = raw.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    const parsed = JSON.parse(raw);
    return { parsed, parser: "claude" };
  } catch (err) {
    console.warn(`[parser] Claude failed, using fallback: ${err.message}`);
    return { parsed: simpleParse(text, channelName, isWorkflow), parser: "fallback" };
  }
}

// ─── Preview logic ───────────────────────────────────────────────────────────
function tsToDate(ts) {
  return new Date(parseFloat(ts) * 1000).toISOString().split("T")[0];
}

async function previewChannel(channelKey, limit) {
  const channel = CHANNELS[channelKey];

  console.log(`\n${channel.name} PREVIEW`);
  console.log(`Found ${await fetchMessages(channel.id, limit).then(m => m.length)} messages to process\n`);

  try {
    const messages = await fetchMessages(channel.id, limit);

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const username = await resolveUsername(msg.user);

      console.log(`\nMessage ${i + 1}/${messages.length}`);

      // Show raw message
      console.log(`\nRAW SLACK MESSAGE:`);
      console.log(msg.text);

      // Detect if this is a workflow message from Slack metadata
      const isWorkflow = msg.subtype === "bot_message";

      // Parse message
      const { parsed, parser } = await parseMessageWithClaude(msg.text, channel.name, isWorkflow);

      if (parsed.skip) {
        console.log(`\nSKIPPED (not a product request)\n`);
        continue;
      }

      // Show what would be inserted
      const entry = {
        id: `${channel.idPrefix}-${msg.ts}`,  // Use Slack message timestamp as ID
        merchant: parsed.merchant || "Unknown",
        app_id: parsed.appId || null,
        mrr: parsed.mrr || 0,
        arr: parsed.mrr ? parsed.mrr * 12 : 0,  // Calculate ARR from MRR
        type: parsed.type || "feature",
        category: parsed.category || "Product",
        request_group: parsed.requestGroup || "Uncategorized",
        request: msg.text,  // Always use raw Slack text
        context: parsed.context || null,  // AI-generated summary
        submitted_by: parsed.submittedBy !== "Unknown" ? parsed.submittedBy : username,
        date: tsToDate(msg.ts),
        status: "pending",
        asana_id: null,
        slack_ts: msg.ts,
        slack_user: msg.user,
        channel: channel.name,  // Use full channel name like "#ai-feedback"
        is_workflow: isWorkflow,  // Use Slack metadata
      };

      console.log(`\nJSON TO BE INSERTED (using ${parser} parser):`);
      console.log(JSON.stringify(entry, null, 2));

      console.log(`\n`);
    }

    console.log(`Preview complete for ${channel.name}\n`);

  } catch (err) {
    console.error(`Error previewing ${channel.name}: ${err.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const channelArg = args.find((a, i) => args[i - 1] === "--channel");
  const limitArg = args.find((a, i) => args[i - 1] === "--limit");

  const channelKeys = channelArg ? [channelArg] : Object.keys(CHANNELS);
  const limit = limitArg ? parseInt(limitArg) : 5;

  console.log(`\nSYNC PREVIEW (DRY RUN)`);
  console.log(`Parser: ${USE_CLAUDE ? 'Claude AI + fallback' : 'Simple fallback only'}`);
  console.log(`Limit: ${limit} messages per channel`);

  for (const key of channelKeys) {
    await previewChannel(key, limit);
  }

  console.log(`\nPreview complete! No data was written to the database.`);
  console.log(`To actually sync to database, run: node slackSyncDB.js\n`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
