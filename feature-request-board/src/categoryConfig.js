// ─── Centralized category definitions & colors ──────────────────────────────

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Accessibility',
  'Analytics',
  'API/Dev',
  'Billing',
  'Cart',
  'Checkout',
  'Compliance',
  'Documentation',
  'For You Feed',
  'Integrations',
  'Loyalty',
  'Media',
  'Messaging',
  'Navigation',
  'PDP',
  'Personalization',
  'Product',
  'Promotions',
  'Push Flows',
  'Reviews',
  'Search',
  'Subscriptions',
  'Wishlist',
];

export const DEFAULT_AI_CATEGORIES = [
  'AI Push Flows',
  'For You Feed',
  'AI Content & Video Generation',
  'AI Autopilot',
  'AI Billing & Pricing',
  'Analytics & Reporting',
  'Other',
];

export const CATEGORY_COLORS = {
  // Product channel categories
  Loyalty:           "#A78BFA",
  Reviews:           "#F472B6",
  Checkout:          "#34D399",
  Subscriptions:     "#60A5FA",
  Personalization:   "#FB923C",
  Cart:              "#FBBF24",
  Navigation:        "#6EE7B7",
  Search:            "#93C5FD",
  PDP:               "#FCA5A5",
  "Push Flows":      "#C4B5FD",
  "API/Dev":         "#67E8F9",
  Analytics:         "#86EFAC",
  Product:           "#FDA4AF",
  Wishlist:          "#FDE68A",
  Integrations:      "#A5F3FC",
  Promotions:        "#FBB6CE",
  Messaging:         "#BBF7D0",
  Media:             "#DDD6FE",
  Accessibility:     "#BAE6FD",
  Billing:           "#FEF3C7",
  Compliance:        "#FCE7F3",
  Documentation:     "#E5E7EB",
  "For You Feed":    "#FCD34D",
  // AI-specific (legacy)
  "AI Pushes":       "#7C6AF7",
  "AI Copy":         "#A78BFA",
  "AI Personalization": "#FB923C",
  "AI Analytics":    "#34D399",
  // AI Feedback channel categories
  "AI Push Flows":              "#C4B5FD",
  "AI Content & Video Generation": "#DDD6FE",
  "AI Autopilot":               "#7C6AF7",
  "AI Billing & Pricing":       "#FEF3C7",
  "Analytics & Reporting":      "#86EFAC",
  "Other":                      "#9CA3AF",
};

const FALLBACK_PALETTE = [
  '#F472B6', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA',
  '#FB923C', '#67E8F9', '#86EFAC', '#FDA4AF', '#FDE68A',
];

export function getCategoryColor(name) {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}
