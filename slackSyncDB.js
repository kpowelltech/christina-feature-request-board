/**
 * slackSyncDB.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Slack to Database sync utility for Tapcart Feature Request Board
 *
 * Polls two Slack channels and writes directly to PostgreSQL:
 *   • #product      → feature/bug requests from the CS/Solutions team
 *   • #ai-feedback  → AI Pro feature feedback
 *
 * Features:
 *   - Writes directly to Neon PostgreSQL database
 *   - Deduplicates using Slack message timestamp (slack_ts)
 *   - Optional Claude-powered parsing (with simple fallback)
 *   - Can run one-shot or in watch mode
 *
 * Usage:
 *   node slackSyncDB.js                  # one-shot sync both channels
 *   node slackSyncDB.js --watch          # polls every 5 minutes
 *   node slackSyncDB.js --channel ai     # only sync #ai-feedback
 *   node slackSyncDB.js --channel product # only sync #product
 *
 * Environment variables (set in .env):
 *   DATABASE_URL           – Neon PostgreSQL connection string
 *   SLACK_BOT_TOKEN        – Bot token with channels:history scope
 *   PRODUCT_CHANNEL_ID     – Slack channel ID for #product
 *   AI_FEEDBACK_CHANNEL_ID – Slack channel ID for #ai-feedback
 *   ANTHROPIC_API_KEY      – (Optional) For Claude-powered parsing
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";

// ─── Config ───────────────────────────────────────────────────────────────────
const SLACK_API_BASE    = "https://slack.com/api";
const POLL_INTERVAL_MS  = 5 * 60 * 1000; // 5 minutes
const MAX_MESSAGES      = 200;            // per sync per channel
const USE_CLAUDE        = !!process.env.ANTHROPIC_API_KEY; // Auto-detect if available

const CHANNELS = {
  product: {
    id:       process.env.PRODUCT_CHANNEL_ID    || "REPLACE_WITH_CHANNEL_ID",
    name:     "#product",
    idPrefix: "prod",
    channel:  "product",
  },
  ai: {
    id:       process.env.AI_FEEDBACK_CHANNEL_ID || "REPLACE_WITH_CHANNEL_ID",
    name:     "#ai-feedback",
    idPrefix: "ai",
    channel:  "ai",
  },
};

// ─── Database connection ──────────────────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL);

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
  // Only process structured workflow messages (bot_message / workflow_message)
  return (data.messages || []).filter(m => m.type === "message" && (m.subtype === "bot_message" || m.subtype === "workflow_message") && m.text?.trim());
}

async function resolveUsername(userId) {
  try {
    const data = await slackFetch("users.info", { user: userId });
    return data.user?.profile?.display_name || data.user?.real_name || userId;
  } catch {
    return userId;
  }
}

// ─── Category mapping for AI feedback workflows ─────────────────────────────
const AI_CATEGORIES = [
  "AI Push Flows", "For You Feed", "AI Content & Video Generation",
  "AI Autopilot", "AI Billing & Pricing", "Analytics & Reporting", "Other",
];

function mapWorkflowCategory(rawCategory, requestText) {
  const combined = `${rawCategory || ""} ${requestText || ""}`.toLowerCase();

  if (/push|flow|welcome|abandon|winback|browse abandon|notification|pn\b/.test(combined)) return "AI Push Flows";
  if (/for you|fyf|feed|discovery|recommend/.test(combined)) return "For You Feed";
  if (/content|video|image|copy|generat|media/.test(combined)) return "AI Content & Video Generation";
  if (/autopilot|autonom/.test(combined)) return "AI Autopilot";
  if (/billing|pricing|credit|trial|subscription/.test(combined)) return "AI Billing & Pricing";
  if (/analytics|reporting|dashboard|metric|attribution|performance data/.test(combined)) return "Analytics & Reporting";

  return "Other";
}

// ─── Category mapping for product channel workflows ──────────────────────────
const PRODUCT_CATEGORIES = [
  "Loyalty", "Reviews", "Checkout", "Subscriptions", "Personalization",
  "Cart", "Navigation", "Search", "PDP", "Push Flows", "API/Dev",
  "Analytics", "Product", "Wishlist", "Integrations", "Promotions",
  "Messaging", "Media", "Accessibility", "Billing", "Compliance",
  "Documentation", "For You Feed",
];

function mapProductWorkflowCategory(rawCategory, requestText) {
  // First try direct match against known categories (case-insensitive)
  if (rawCategory) {
    const directMatch = PRODUCT_CATEGORIES.find(
      c => c.toLowerCase() === rawCategory.trim().toLowerCase()
    );
    if (directMatch) return directMatch;
  }

  // Fall back to keyword matching
  const combined = `${rawCategory || ""} ${requestText || ""}`.toLowerCase();

  if (/loyalty|reward|points|program/.test(combined)) return "Loyalty";
  if (/review|rating|testimonial/.test(combined)) return "Reviews";
  if (/checkout|payment|purchase|order/.test(combined)) return "Checkout";
  if (/subscription|recurring|rebill|recharge/.test(combined)) return "Subscriptions";
  if (/personali[zs]|custom|tailor/.test(combined)) return "Personalization";
  if (/\bcart\b|bag|add to cart/.test(combined)) return "Cart";
  if (/nav|menu|header|footer|tab.bar/.test(combined)) return "Navigation";
  if (/search|find|filter|sort/.test(combined)) return "Search";
  if (/pdp|product.detail|product.page/.test(combined)) return "PDP";
  if (/push|flow|notification|welcome|abandon|winback/.test(combined)) return "Push Flows";
  if (/api|webhook|developer|sdk|cli/.test(combined)) return "API/Dev";
  if (/analytics|tracking|metric|dashboard|report|attribution/.test(combined)) return "Analytics";
  if (/wishlist|wish.list|save.for.later|favorite/.test(combined)) return "Wishlist";
  if (/integrat|klaviyo|yotpo|appsflyer|third.party/.test(combined)) return "Integrations";
  if (/promo|discount|coupon|sale|offer/.test(combined)) return "Promotions";
  if (/messag|sms|email|chat|inbox/.test(combined)) return "Messaging";
  if (/media|video|image|photo|content|generat/.test(combined)) return "Media";
  if (/accessib|ada|wcag|screen.reader/.test(combined)) return "Accessibility";
  if (/billing|pricing|credit|trial|invoice/.test(combined)) return "Billing";
  if (/complian|gdpr|privacy|security|legal/.test(combined)) return "Compliance";
  if (/doc|guide|tutorial|help.center/.test(combined)) return "Documentation";
  if (/for.you|fyf|feed|discover|recommend/.test(combined)) return "For You Feed";

  return "Other";
}

// ─── Simple fallback parser (no AI required) ──────────────────────────────────
function simpleParse(text, channelName, isWorkflow = false) {
  const lowerText = text.toLowerCase();

  if (isWorkflow) {
    // Parse workflow format: *Field Name*\nValue
    const merchant = text.match(/\*Merchant Name\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || "Unknown";
    const appId = text.match(/\*App ID\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;
    const mrrRaw = text.match(/\*MRR\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || "0";
    const mrr = parseInt(mrrRaw.replace(/[$,]/g, "")) || 0;
    const topic = text.match(/\*Topic:?\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim() || null;
    const workflowCategory = text.match(/\*Category\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim();
    // Product form uses "Feedback Details", AI form uses "Feedback"
    const feedback = text.match(/\*Feedback Details\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim()
      || text.match(/\*Feedback\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim()
      || "";
    // Product form has a Type field (Feature/Integration)
    const typeRaw = text.match(/\*Type\*\s*\n\s*([^\n*]+)/i)?.[1]?.trim().toLowerCase();

    // Map category based on channel
    const category = channelName === "#ai-feedback"
      ? mapWorkflowCategory(workflowCategory, feedback)
      : mapProductWorkflowCategory(workflowCategory, feedback);
    const requestGroup = category;

    return {
      merchant,
      appId,
      mrr,
      topic,
      request: feedback,
      type: typeRaw === "integration" ? "integration" : "feature",
      category,
      requestGroup,
      context: null,
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
    "Push Flows": ["push", "notification", "alert"],
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

// ─── Claude-powered parser (optional) ─────────────────────────────────────────
const anthropic = USE_CLAUDE ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Product channel system prompt
const PRODUCT_PARSE_PROMPT = `You are a data extraction assistant for a mobile commerce platform (Tapcart).
You receive raw Slack messages from internal team channels and must extract structured product/feature request data.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "merchant": "string | 'Unknown'",
  "appId": "string | null",
  "mrr": "number (monthly recurring revenue)",
  "type": "feature | integration",
  "category": "one of: Cart, Checkout, PDP, Search, Navigation, Push Flows, Loyalty, Reviews, Analytics, API/Dev, Product, Wishlist, Integrations, Promotions, Messaging, Media, Accessibility, Billing, Compliance, Documentation, Personalization, Subscriptions, For You Feed",
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

// AI Feedback channel system prompt (7 AI-focused categories)
const AI_FEEDBACK_PARSE_PROMPT = `You are a data extraction assistant for Tapcart's AI Pro product.
You receive raw Slack messages from the #ai-feedback channel containing AI-specific feature requests and feedback.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "merchant": "string | 'Unknown'",
  "appId": "string | null",
  "mrr": "number (monthly recurring revenue)",
  "type": "feature | integration",
  "category": "one of: AI Push Flows, For You Feed, AI Content & Video Generation, AI Autopilot, AI Billing & Pricing, Analytics & Reporting, Other",
  "requestGroup": "2-6 word group label summarizing the topic (used for deduplication grouping)",
  "context": "one-sentence summary or context of the request (what they want and why), or null",
  "submittedBy": "name of person submitting if mentioned, else 'Unknown'"
}

Rules:
- type="integration" if the request involves a third-party tool
- type="feature" for AI product features, improvements, and bugs
- Category selection guide:
  * "AI Push Flows": Push notifications, flows (welcome, abandon cart, browse, winback), AI tuning, guardrails, timing
  * "For You Feed": Product discovery, recommendations, FYF-specific features
  * "AI Content & Video Generation": AI-generated copy, images, videos, media creation
  * "AI Autopilot": Autopilot features and autonomous AI behavior
  * "AI Billing & Pricing": Credits, trials, billing, pricing, subscription concerns
  * "Analytics & Reporting": Dashboards, metrics, attribution, performance data
  * "Other": Anything that doesn't clearly fit the above
- requestGroup must be concise and reusable — similar requests from different merchants should get the same requestGroup
- context should be a helpful one-sentence summary that captures the essence of the request`;

function getSystemPrompt(channelName) {
  // #ai-feedback: AI-specific categories
  if (channelName === "#ai-feedback") {
    return AI_FEEDBACK_PARSE_PROMPT;
  }
  // #product: product categories with skip instruction
  return PRODUCT_PARSE_PROMPT;
}

// Rate limiting: track last API call time
let lastApiCallTime = 0;
const MIN_API_DELAY_MS = 12500; // 12.5 seconds = ~4.8 calls/min (under 5/min limit)

async function summarizeRequest(requestText) {
  if (!USE_CLAUDE || !requestText) return null;

  try {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < MIN_API_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_API_DELAY_MS - timeSinceLastCall));
    }
    lastApiCallTime = Date.now();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 128,
      system: "You summarize customer feedback into one concise sentence. Return ONLY the summary, no quotes or explanation.",
      messages: [{ role: "user", content: requestText }],
    });

    return response.content[0]?.text?.trim() || null;
  } catch (err) {
    console.warn(`[summarize] Failed: ${err.message}`);
    return null;
  }
}

async function parseMessageWithClaude(text, channelName, isWorkflow = false) {
  // For workflow messages, use simple parser for field extraction
  if (isWorkflow) {
    return simpleParse(text, channelName, isWorkflow);
  }

  if (!USE_CLAUDE) {
    return simpleParse(text, channelName, isWorkflow);
  }

  try {
    // Rate limiting: ensure minimum delay between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < MIN_API_DELAY_MS) {
      const delayNeeded = MIN_API_DELAY_MS - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    lastApiCallTime = Date.now();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: getSystemPrompt(channelName), // Use channel-aware prompt
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

    // For #ai-feedback channel, never skip messages
    if (channelName === "#ai-feedback" && parsed.skip) {
      delete parsed.skip; // Remove skip flag if present
    }

    return parsed;
  } catch (err) {
    console.warn(`[parser] Claude failed, using fallback: ${err.message}`);
    return simpleParse(text, channelName, isWorkflow);
  }
}

// ─── Topic Assignment ─────────────────────────────────────────────────────────
function assignTopic(category, requestGroup, request, context, channel) {
  const lowerRequest = (request + " " + (context || "")).toLowerCase();

  // ===== PRODUCT CHANNEL TOPICS =====

  // PUSH FLOWS TOPICS (Product channel)
  if (category === "Push Flows" && channel !== "#ai-feedback") {
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

  // ANALYTICS TOPICS (Product channel)
  if (category === "Analytics" && channel !== "#ai-feedback") {
    if (lowerRequest.match(/push.*analytic|dashboard|date range/)) return "AI Push Analytics";
    if (lowerRequest.match(/attribution|accuracy|discrepancy|cvr|credit.*track/)) return "Attribution & Data Accuracy";
    if (lowerRequest.match(/winback|cart recovery|migration/)) return "Flow-Specific Analytics";
    if (lowerRequest.match(/visibility|can't see|dashboard/)) return "Dashboard Visibility";
    return "Dashboard Visibility"; // default
  }

  // MEDIA TOPICS (Product channel)
  if (category === "Media" && channel !== "#ai-feedback") {
    if (lowerRequest.match(/video.*ui/)) return "AI Video UI";
    if (lowerRequest.match(/video.*edit/)) return "AI Video Editing";
    if (lowerRequest.match(/video.*generat/)) return "AI Video Generation";
    if (lowerRequest.match(/image/)) return "AI Images";
    return "AI Video"; // default
  }

  // API/DEV TOPICS (Product channel)
  if (category === "API/Dev" && channel !== "#ai-feedback") {
    if (lowerRequest.match(/cli/)) return "CLI Access";
    if (lowerRequest.match(/security/)) return "Security";
    return "Security"; // default
  }

  // ===== AI FEEDBACK CHANNEL TOPICS (Dynamic subtopics) =====

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
    // Use requestGroup as dynamic subtopic if nothing matches
    return requestGroup || "General Push Flows";
  }

  // FOR YOU FEED SUBTOPICS
  if (category === "For You Feed") {
    if (lowerRequest.match(/discovery|browse|explore/)) return "Product Discovery";
    if (lowerRequest.match(/recommend|suggestion|personali/)) return "Recommendations";
    if (lowerRequest.match(/integration|data|sync/)) return "Data Integration";
    if (lowerRequest.match(/ui|interface|design|layout/)) return "UI/UX";
    if (lowerRequest.match(/performance|speed|load/)) return "Performance";
    // Use requestGroup as dynamic subtopic
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
    // Use requestGroup as dynamic subtopic
    return requestGroup || "General Content";
  }

  // AI AUTOPILOT SUBTOPICS
  if (category === "AI Autopilot") {
    if (lowerRequest.match(/automation|auto.*mode/)) return "Automation";
    if (lowerRequest.match(/control|override|manual/)) return "Controls";
    if (lowerRequest.match(/config|setting|preference/)) return "Configuration";
    // Use requestGroup as dynamic subtopic
    return requestGroup || "General Autopilot";
  }

  // AI BILLING & PRICING SUBTOPICS
  if (category === "AI Billing & Pricing") {
    if (lowerRequest.match(/credit|usage|consumption/)) return "Credits & Usage";
    if (lowerRequest.match(/trial|demo|test/)) return "Trials";
    if (lowerRequest.match(/pric|cost|fee|charge/)) return "Pricing";
    if (lowerRequest.match(/bill|invoice|payment/)) return "Billing";
    if (lowerRequest.match(/plan|tier|subscription/)) return "Plans & Tiers";
    // Use requestGroup as dynamic subtopic
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
    // Use requestGroup as dynamic subtopic
    return requestGroup || "General Analytics";
  }

  // OTHER CATEGORY - use requestGroup as subtopic
  if (category === "Other") {
    return requestGroup || "Uncategorized";
  }

  // No topic for other categories
  return null;
}

// ─── Database helpers ─────────────────────────────────────────────────────────
function tsToDate(ts) {
  return new Date(parseFloat(ts) * 1000).toISOString().split("T")[0];
}

async function getNextId(channel) {
  const prefix = channel === "ai" ? "ai" : "prod";
  const result = await sql`
    SELECT id FROM feature_requests
    WHERE id LIKE ${prefix + '-%'}
    ORDER BY id DESC
    LIMIT 1
  `;

  if (result.length === 0) {
    return `${prefix}-0001`;
  }

  const lastNum = parseInt(result[0].id.split('-')[1]) || 0;
  return `${prefix}-${String(lastNum + 1).padStart(4, '0')}`;
}

async function insertRequest(entry) {
  await sql`
    INSERT INTO feature_requests (
      id, merchant, app_id, mrr, arr, type, category, request_group, topic, request, context,
      submitted_by, date, status, slack_ts, slack_user, channel, is_workflow
    ) VALUES (
      ${entry.id}, ${entry.merchant}, ${entry.appId}, ${entry.mrr}, ${entry.arr}, ${entry.type},
      ${entry.category}, ${entry.requestGroup}, ${entry.topic}, ${entry.request}, ${entry.context},
      ${entry.submittedBy}, ${entry.date}, ${entry.status}, ${entry.slackTs},
      ${entry.slackUser}, ${entry.channel}, ${entry.isWorkflow}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

async function getExistingSlackTs(channel) {
  // Note: Includes ALL records (active AND deleted) to prevent re-hydration of deleted entries
  const result = await sql`
    SELECT slack_ts FROM feature_requests
    WHERE channel = ${channel} AND slack_ts IS NOT NULL
  `;
  return new Set(result.map(r => r.slack_ts));
}

async function getLatestSlackTs(channel) {
  // Note: Includes ALL records (active AND deleted) to get the true latest timestamp
  const result = await sql`
    SELECT slack_ts FROM feature_requests
    WHERE channel = ${channel} AND slack_ts IS NOT NULL
    ORDER BY slack_ts DESC
    LIMIT 1
  `;
  return result.length > 0 ? parseFloat(result[0].slack_ts) : 0;
}

// ─── Sync logic ───────────────────────────────────────────────────────────────
async function syncChannel(channelKey) {
  const channel = CHANNELS[channelKey];
  if (!channel) throw new Error(`Unknown channel key: ${channelKey}`);

  const existingTs = await getExistingSlackTs(channel.name);
  const latestTs   = await getLatestSlackTs(channel.name);

  console.log(`\n[sync] ${channel.name} — fetching messages since ${latestTs ? new Date(latestTs * 1000).toISOString() : "beginning"}...`);

  let messages;
  try {
    messages = await fetchChannelHistory(channel.id, latestTs || null);
  } catch (err) {
    console.error(`[sync] Failed to fetch ${channel.name}:`, err.message);
    return { added: [], skipped: 0, errors: 1 };
  }

  console.log(`[sync] ${messages.length} new messages found`);
  console.log(`[parser] Using ${USE_CLAUDE ? 'Claude AI' : 'simple fallback'} parser`);

  const added    = [];
  let   skipped  = 0;
  let   errors   = 0;

  for (const msg of messages) {
    if (existingTs.has(msg.ts)) {
      skipped++;
      continue;
    }

    // Detect if this is a workflow message from Slack metadata
    const isWorkflow = msg.subtype === "bot_message";

    let parsed;
    try {
      parsed = await parseMessageWithClaude(msg.text, channel.name, isWorkflow);
    } catch (err) {
      console.error(`[parser] Error on ts=${msg.ts}:`, err.message);
      errors++;
      continue;
    }

    if (parsed.skip) {
      skipped++;
      continue;
    }

    const username = await resolveUsername(msg.user);

    const category = parsed.category || "Product";
    const requestGroup = parsed.requestGroup || "Uncategorized";
    const request = parsed.request || msg.text;
    // For workflow entries, generate a one-sentence AI summary as context
    const context = isWorkflow
      ? await summarizeRequest(request)
      : (parsed.context || null);

    const entry = {
      id:           `${channel.idPrefix}-${msg.ts}`,  // Use Slack message timestamp as ID
      merchant:     parsed.merchant    || "Unknown",
      appId:        parsed.appId       || null,
      mrr:          parsed.mrr         || 0,
      arr:          parsed.mrr ? parsed.mrr * 12 : 0,  // Calculate ARR from MRR
      type:         parsed.type        || "feature",
      category,
      requestGroup,
      topic:        parsed.topic || assignTopic(category, requestGroup, request, context, channel.name),
      request,
      context,
      submittedBy:  parsed.submittedBy !== "Unknown" ? parsed.submittedBy : username,
      date:         tsToDate(msg.ts),
      status:       "pending",
      slackTs:      msg.ts,
      slackUser:    msg.user,
      channel:      channel.name,
      isWorkflow,
    };

    try {
      await insertRequest(entry);
      added.push(entry);
      console.log(`  + [${entry.id}] ${entry.merchant} — ${entry.request.slice(0, 60)}`);
    } catch (err) {
      console.error(`[db] Failed to insert ${entry.id}:`, err.message);
      errors++;
    }
  }

  console.log(`[sync] Complete — ${added.length} added, ${skipped} skipped, ${errors} errors`);

  return { added, skipped, errors };
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────
async function main() {
  const args       = process.argv.slice(2);
  const watchMode  = args.includes("--watch");
  const channelArg = args.find((a, i) => args[i - 1] === "--channel");
  const channelKeys = channelArg ? [channelArg] : Object.keys(CHANNELS);

  console.log(`\n🔄 Slack to Database Sync`);
  console.log(`📊 Target: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'PostgreSQL'}`);
  console.log(`🤖 Parser: ${USE_CLAUDE ? 'Claude AI + fallback' : 'Simple fallback only'}\n`);

  const runOnce = async () => {
    const results = {};
    for (const key of channelKeys) {
      results[key] = await syncChannel(key);
    }
    const totalAdded = Object.values(results).reduce((s, r) => s + r.added.length, 0);
    console.log(`\n✅ Sync complete — ${totalAdded} new requests added to database\n`);
    return results;
  };

  if (watchMode) {
    console.log(`[watch] Polling every ${POLL_INTERVAL_MS / 1000}s — Ctrl+C to stop\n`);
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

export { syncChannel, fetchChannelHistory, CHANNELS };
