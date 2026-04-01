import { useState, useMemo, useEffect, useRef } from "react";
import { REQUESTS_DATA } from "./requestsData";
import { AI_FEEDBACK_DATA } from "./aiFeedbackData";
import { useAuth } from "./contexts/AuthContext";
import DeleteModal from "./components/DeleteModal";
import EditModal from "./components/EditModal";
import CombineModal from "./components/CombineModal";
import SuggestCombineModal from "./components/SuggestCombineModal";

// ─── Shared config ────────────────────────────────────────────────────────────
const statusConfig = {
  pending:     { label: "Pending",     color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  in_progress: { label: "In Progress", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  qa:          { label: "QA",          color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  done:        { label: "Done",        color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  blocked:     { label: "Blocked",     color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

const categoryColors = {
  // Product channel categories (original 23)
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
  // AI-specific
  "AI Pushes":       "#7C6AF7",
  "AI Copy":         "#A78BFA",
  "AI Personalization": "#FB923C",
  "AI Analytics":    "#34D399",
  // AI Feedback channel categories (7 new)
  "AI Push Flows":              "#C4B5FD",  // Purple
  "AI Content & Video Generation": "#DDD6FE",  // Lavender
  "AI Autopilot":               "#7C6AF7",  // Deep Purple
  "AI Billing & Pricing":       "#FEF3C7",  // Light Yellow
  "Analytics & Reporting":      "#86EFAC",  // Green
  "Other":                      "#9CA3AF",  // Gray
};

function getSlackChannelId(slackChannel) {
  return slackChannel === '#product'
    ? import.meta.env.VITE_PRODUCT_CHANNEL_ID || 'C0000000000'
    : import.meta.env.VITE_AI_FEEDBACK_CHANNEL_ID || 'C0000000000';
}

function getSlackMessageUrl(slackTs, slackChannel) {
  const channelId = getSlackChannelId(slackChannel);
  const teamId = import.meta.env.VITE_SLACK_TEAM_ID;
  // slack:// protocol opens the desktop app directly, no browser sign-in needed
  if (teamId) {
    return `slack://channel?team=${teamId}&id=${channelId}&message=${slackTs}`;
  }
  return `https://tapcart.slack.com/archives/${channelId}/p${slackTs.replace('.', '')}`;
}

function formatMRR(n) {
  if (!n) return "—";
  return `$${(n / 1000).toFixed(1)}k`;
}
function formatARR(n) {
  if (!n) return "—";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  return `$${(n / 1000).toFixed(0)}k`;
}
function groupStatus(rows) {
  if (rows.every(r => r.status === "done")) return "done";
  if (rows.some(r => r.status === "blocked")) return "blocked";
  if (rows.some(r => r.status === "qa")) return "qa";
  if (rows.some(r => r.status === "in_progress")) return "in_progress";
  return "pending";
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #15161E; }
  ::-webkit-scrollbar-thumb { background: #2A2C3A; border-radius: 3px; }
  button { cursor: pointer; border: none; }
  input, select { outline: none; }
  .tab-btn { background: none; color: #6B7280; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.08em; padding: 8px 16px; border-bottom: 2px solid transparent; transition: all 0.15s; }
  .tab-btn.active { color: #E2E4EC; border-bottom-color: #7C6AF7; }
  .tab-btn.active-ai { color: #E2E4EC; border-bottom-color: #7C6AF7; }
  .tab-btn:hover:not(.active):not(.active-ai) { color: #9CA3AF; }
  .filter-select { background: #15161E; color: #9CA3AF; border: 1px solid #1E2030; font-family: 'DM Mono', monospace; font-size: 11px; padding: 6px 10px; border-radius: 4px; }
  .sort-btn { background: #15161E; color: #6B7280; border: 1px solid #1E2030; font-family: 'DM Mono', monospace; font-size: 11px; padding: 6px 12px; border-radius: 4px; transition: all 0.15s; }
  .sort-btn.active { color: #E2E4EC; border-color: #7C6AF7; background: rgba(124,106,247,0.1); }
  .sort-btn:hover:not(.active) { color: #9CA3AF; border-color: #2A2C3A; }
  .action-btn { font-family: 'DM Mono', monospace; font-size: 11px; padding: 5px 10px; border-radius: 4px; transition: all 0.15s; white-space: nowrap; }
  .action-btn:hover { filter: brightness(1.2); }
  .stat-card { background: #13141A; border: 1px solid #1E2030; border-radius: 8px; padding: 20px 24px; }
  .rollup-bar { background: #1E2030; border-radius: 3px; height: 6px; overflow: hidden; }
  .rollup-bar-fill { height: 100%; border-radius: 3px; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: #13141A; border: 1px solid #2A2C3A; border-radius: 6px; padding: 12px 18px; font-size: 12px; color: #E2E4EC; z-index: 1000; animation: fadeInUp 0.3s ease; }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .modal { background: #13141A; border: 1px solid #2A2C3A; border-radius: 10px; padding: 28px; width: 560px; max-width: 95vw; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; letter-spacing: 0.06em; font-weight: 500; }
  .group-row { border: 1px solid #1E2030; border-radius: 8px; overflow: hidden; margin-bottom: 8px; transition: border-color 0.15s; }
  .group-row:hover { border-color: #2A2C3A; }
  .group-header { display: flex; align-items: center; padding: 13px 16px; background: #13141A; cursor: pointer; gap: 12px; }
  .group-header:hover { background: #141520; }
  .merchant-sub-row { display: flex; align-items: flex-start; padding: 10px 16px 10px 44px; border-top: 1px solid #1A1B24; background: #0A0B10; gap: 12px; }
  .chevron { color: #4B5563; font-size: 9px; transition: transform 0.2s; width: 16px; flex-shrink: 0; margin-top: 1px; }
  .chevron.open { transform: rotate(90deg); }
  .type-pill { border-radius: 4px; padding: 3px 10px; font-size: 10px; font-family: 'DM Mono', monospace; cursor: pointer; transition: all 0.15s; }
  .ai-glow { box-shadow: 0 0 0 1px rgba(124,106,247,0.3), 0 0 20px rgba(124,106,247,0.08); }
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  .skeleton { background: linear-gradient(90deg, #1E2030 25%, #2A2C3A 50%, #1E2030 75%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; border-radius: 4px; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

// ─── Reusable RequestsPanel ───────────────────────────────────────────────────
function RequestsPanel({
  data,
  setData,
  showToast,
  slackChannel = "#product",
  accentColor = "#7C6AF7",
  onDelete,
  onEdit,
  onStatusChange,
  isAiChannel = false,
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onOpenCombine,
  onOpenAiSuggest,
  loading = false,
}) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [subTab, setSubTab] = useState("requests");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedSubtopics, setExpandedSubtopics] = useState({});
  const [slackModal, setSlackModal] = useState(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [expandedCompletedGroups, setExpandedCompletedGroups] = useState({});
  const [expandedCompletedSubtopics, setExpandedCompletedSubtopics] = useState({});

  const toggleGroup = (key) =>
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleSubtopic = (key) =>
    setExpandedSubtopics(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleCompletedGroup = (key) =>
    setExpandedCompletedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleCompletedSubtopic = (key) =>
    setExpandedCompletedSubtopics(prev => ({ ...prev, [key]: !prev[key] }));

  const activeData = useMemo(() => data.filter(r => r.status !== "done"), [data]);
  const completedData = useMemo(() => data.filter(r => r.status === "done"), [data]);

  const handleSendToSlack = (group) => {
    const merchantList = group.rows
      .map(r => `  • ${r.merchant !== "Unknown" ? r.merchant : "(merchant TBD)"} — ${r.request}${r.context ? `\n    _${r.context.slice(0, 120)}${r.context.length > 120 ? "…" : ""}_` : ""}`)
      .join("\n");
    const text = `📋 *Feature Request — Action Needed*\n\n*Request Group:* ${group.key}\n*Type:* ${group.type === "integration" ? "Integration" : "Feature"} · ${group.category}\n*Submitted by:* ${[...new Set(group.rows.map(r => r.submittedBy).filter(s => s && s !== "Unknown"))].join(", ") || "Team"}\n\n*Reports (${group.rows.length}):*\n${merchantList}\n\n_Please review and create an Asana ticket if actionable._`;
    setSlackModal({ group, text });
  };

  const confirmSendToSlack = () => {
    const ids = slackModal.group.rows.map(r => r.id);
    setData(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: "sent_to_slack" } : r));
    setSlackModal(null);
    showToast(`Summary sent to ${slackChannel} ✓`);
  };

  const buildGrouped = (items) => {
    const categoryMap = {};

    // First, group by category
    items.forEach(r => {
      const categoryKey = r.category || 'Uncategorized';
      if (!categoryMap[categoryKey]) {
        categoryMap[categoryKey] = {
          key: categoryKey,
          type: r.type,
          category: r.category,
          subtopics: {},
          rows: [],
          totalMrr: 0,
          totalArr: 0
        };
      }

      // Then group by subtopic within category
      const subtopicKey = r.topic || r.requestGroup || 'Uncategorized';
      if (!categoryMap[categoryKey].subtopics[subtopicKey]) {
        categoryMap[categoryKey].subtopics[subtopicKey] = {
          key: subtopicKey,
          type: r.type,
          category: r.category,
          rows: [],
          totalMrr: 0,
          totalArr: 0
        };
      }

      // Add to subtopic
      categoryMap[categoryKey].subtopics[subtopicKey].rows.push(r);
      categoryMap[categoryKey].subtopics[subtopicKey].totalMrr += (r.mrr || 0);
      categoryMap[categoryKey].subtopics[subtopicKey].totalArr += (r.arr || 0);

      // Also add to category totals
      categoryMap[categoryKey].rows.push(r);
      categoryMap[categoryKey].totalMrr += (r.mrr || 0);
      categoryMap[categoryKey].totalArr += (r.arr || 0);
    });

    // Convert subtopics object to array for each category
    return Object.values(categoryMap).map(cat => ({
      ...cat,
      subtopics: Object.values(cat.subtopics)
    }));
  };

  const grouped = useMemo(() => buildGrouped(activeData), [activeData]);
  const completedGrouped = useMemo(() => buildGrouped(completedData), [completedData]);

  const totalARR = useMemo(() => data.reduce((s, r) => s + (r.arr || 0), 0), [data]);
  const totalMerchants = useMemo(() => new Set(data.map(r => r.merchant).filter(m => m && m !== "Unknown")).size, [data]);

  const rollups = useMemo(() => {
    const byFeature = {};
    data.forEach(r => {
      const key = r.category;
      if (!byFeature[key]) byFeature[key] = { count: 0, mrr: 0, arr: 0, merchants: new Set() };
      byFeature[key].count++;
      byFeature[key].mrr += (r.mrr || 0);
      byFeature[key].arr += (r.arr || 0);
      byFeature[key].merchants.add(r.merchant);
    });
    return Object.entries(byFeature)
      .map(([cat, v]) => ({ cat, ...v, merchantCount: v.merchants.size }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const categories = [...new Set(data.map(r => r.category))].sort();

  const filteredGroups = useMemo(() => {
    let result = grouped.filter(g => {
      if (filterCategory !== "all" && g.category !== filterCategory) return false;
      if (filterStatus !== "all" && groupStatus(g.rows) !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return g.key.toLowerCase().includes(s) ||
          g.category.toLowerCase().includes(s) ||
          g.rows.some(r => (r.merchant || "").toLowerCase().includes(s) || r.request.toLowerCase().includes(s));
      }
      return true;
    });

    return [...result].sort((a, b) => {
      if (sortBy === "arr") return b.totalArr - a.totalArr;
      if (sortBy === "merchants") return b.rows.length - a.rows.length;
      if (sortBy === "type") return a.type.localeCompare(b.type) || b.rows.length - a.rows.length;
      if (sortBy === "category") return a.category.localeCompare(b.category) || b.rows.length - a.rows.length;
      if (sortBy === "date") {
        const aDate = Math.max(...a.rows.map(r => new Date(r.date).getTime()));
        const bDate = Math.max(...b.rows.map(r => new Date(r.date).getTime()));
        return bDate - aDate;
      }
      return 0;
    });
  }, [grouped, filterCategory, filterStatus, search, sortBy]);

  const displaySections = useMemo(() => {
    if (sortBy === "type") {
      const features = filteredGroups.filter(g => g.type === "feature");
      const integrations = filteredGroups.filter(g => g.type === "integration");
      return [
        features.length ? { label: "Features", accent: "#34D399", icon: "◆", groups: features } : null,
        integrations.length ? { label: "Integrations", accent: "#60A5FA", icon: "◈", groups: integrations } : null,
      ].filter(Boolean);
    }
    return [{ label: null, groups: filteredGroups }];
  }, [filteredGroups, sortBy]);

  if (loading) {
    return (
      <div>
        {/* Skeleton stat cards — labels visible, values shimmer */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "24px 0" }}>
          {["Total ARR at Stake", "Unique Merchants", "Categories", "Open / Pending"].map(label => (
            <div key={label} className="stat-card">
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
              <div className="skeleton" style={{ width: 70, height: 26, marginBottom: 4 }} />
              <div className="skeleton" style={{ width: 100, height: 10, marginTop: 4 }} />
            </div>
          ))}
        </div>

        {/* Sub-tabs — real labels, disabled */}
        <div style={{ borderBottom: "1px solid #1E2030", display: "flex", gap: 4, marginBottom: 16 }}>
          <button className="tab-btn active" style={{ pointerEvents: "none" }}>All Requests</button>
          <button className="tab-btn" style={{ pointerEvents: "none" }}>Demand Rollups</button>
        </div>

        {/* Skeleton controls row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div className="skeleton" style={{ width: 260, height: 30, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 120, height: 30, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 110, height: 30, borderRadius: 4 }} />
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {[52, 48, 58, 56, 72].map((w, i) => (
              <div key={i} className="skeleton" style={{ width: w, height: 28, borderRadius: 4 }} />
            ))}
          </div>
        </div>

        {/* Skeleton count line */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
          <div className="skeleton" style={{ width: 140, height: 10, marginLeft: "auto" }} />
        </div>

        {/* Column headers — real labels */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 6px", gap: 12, fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <div style={{ width: 28, flexShrink: 0 }} />
          <div style={{ flex: 2 }}>Topic</div>
          <div style={{ width: 80, textAlign: "center", flexShrink: 0 }}>Reports</div>
          <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>MRR</div>
          <div style={{ width: 90, textAlign: "right", flexShrink: 0 }}>ARR</div>
          <div style={{ width: 100, textAlign: "center", flexShrink: 0 }}>Status</div>
          <div style={{ width: 150, flexShrink: 0 }}>Actions</div>
        </div>

        {/* Skeleton category rows — matching real group-row layout */}
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="group-row" style={{ marginBottom: 8 }}>
            <div className="group-header" style={{ cursor: "default" }}>
              <span className="chevron" style={{ color: "#2A2C3A" }}>▶</span>
              <div style={{ flex: 2, minWidth: 0 }}>
                <div className="skeleton" style={{ width: `${50 + (i % 3) * 20}%`, height: 14, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: `${30 + (i % 4) * 10}%`, height: 10 }} />
              </div>
              <div style={{ textAlign: "center", width: 80, flexShrink: 0 }}>
                <div className="skeleton" style={{ width: 24, height: 14, margin: "0 auto 4px" }} />
                <div className="skeleton" style={{ width: 36, height: 9, margin: "0 auto" }} />
              </div>
              <div style={{ textAlign: "right", width: 80, flexShrink: 0 }}>
                <div className="skeleton" style={{ width: 50, height: 12, marginLeft: "auto" }} />
              </div>
              <div style={{ textAlign: "right", width: 90, flexShrink: 0 }}>
                <div className="skeleton" style={{ width: 60, height: 14, marginLeft: "auto" }} />
              </div>
              <div style={{ width: 100, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 12 }} />
              </div>
              <div style={{ width: 150, display: "flex", gap: 6, flexShrink: 0 }}>
                <div className="skeleton" style={{ width: 60, height: 24, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 50, height: 24, borderRadius: 4 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "24px 0" }}>
        {[
          { label: "Total ARR at Stake",  value: totalARR ? formatARR(totalARR) : data.length, sub: totalARR ? "across all requests" : "total requests logged" },
          { label: "Unique Merchants",    value: totalMerchants, sub: "requesting features" },
          { label: "Categories",            value: grouped.length, sub: "grouped by topic" },
          { label: "Open / Pending",      value: data.filter(r => r.status === "pending").length, sub: "awaiting action" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: "#E2E4EC", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#4B5563", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ borderBottom: "1px solid #1E2030", display: "flex", gap: 4, marginBottom: 16 }}>
        {["requests", "demand"].map(t => (
          <button key={t} className={`tab-btn ${subTab === t ? "active" : ""}`} onClick={() => setSubTab(t)}>
            {t === "requests" ? "All Requests" : "Demand Rollups"}
          </button>
        ))}
      </div>

      {subTab === "requests" && (
        <div>
          {/* Controls */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Search request, merchant, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: "#15161E", border: "1px solid #1E2030", color: "#E2E4EC", borderRadius: 4, padding: "6px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 260 }}
            />
            <select className="filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="sent_to_slack">Sent to Slack</option>
              <option value="asana_created">In Asana</option>
            </select>
            <div style={{ display: "flex", gap: 4, marginLeft: "auto", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#4B5563", marginRight: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sort</span>
              {[
                { key: "date",      label: "Latest ↓" },
                { key: "arr",       label: "ARR ↓" },
                { key: "merchants", label: "Volume ↓" },
                { key: "type",      label: "By Type" },
                { key: "category",  label: "By Category" },
              ].map(s => (
                <button key={s.key} className={`sort-btn ${sortBy === s.key ? "active" : ""}`} onClick={() => setSortBy(s.key)}>
                  {s.label}
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: "#2A2C3A", margin: "0 4px" }} />
              <button
                onClick={onOpenAiSuggest}
                className="sort-btn ai-glow"
                style={{ color: "#A78BFA", borderColor: "#7C6AF730", background: "rgba(124,106,247,0.08)" }}
              >
                AI Suggest Merges
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#4B5563", marginLeft: "auto" }}>
              {filteredGroups.length} group{filteredGroups.length !== 1 ? "s" : ""} · {filteredGroups.reduce((s, g) => s + g.rows.length, 0)} total entries
            </span>
          </div>

          {/* Column headers */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 16px 6px", gap: 12, fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <div style={{ width: 28, flexShrink: 0 }}></div>
            <div style={{ flex: 2 }}>Topic</div>
            <div style={{ width: 80, textAlign: "center", flexShrink: 0 }}>Reports</div>
            <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>MRR</div>
            <div style={{ width: 90, textAlign: "right", flexShrink: 0 }}>ARR</div>
            <div style={{ width: 100, textAlign: "center", flexShrink: 0 }}>Status</div>
            <div style={{ width: 150, flexShrink: 0 }}>Actions</div>
          </div>

          {/* Groups */}
          {displaySections.map(section => (
            <div key={section.label || "all"}>
              {section.label && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 8px", fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  <span style={{ color: section.accent }}>{section.icon} {section.label}</span>
                  <span style={{ color: "#2A2C3A" }}>{section.groups.length} groups</span>
                  <div style={{ flex: 1, height: 1, background: "#1E2030" }} />
                </div>
              )}

              {section.groups.map(category => {
                const isCategoryOpen = !!expandedGroups[category.key];
                const sc = statusConfig[groupStatus(category.rows)];
                const hasMultiple = category.rows.length > 1;

                return (
                  <div key={category.key} className="group-row">
                    <div className="group-header" onClick={() => toggleGroup(category.key)} style={{ cursor: "pointer" }}>
                      <span className={`chevron ${isCategoryOpen ? "open" : ""}`}>▶</span>

                      <div style={{ flex: 2, minWidth: 0 }}>
                        <div style={{ marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#E2E4EC", fontSize: 13, fontWeight: 600 }}>{category.key}</span>
                          <span style={{ fontSize: 9, color: "#4B5563" }}>{category.subtopics.length} subtopic{category.subtopics.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#6B7280" }}>
                          {category.subtopics.slice(0, 3).map(st => st.key).join(", ")}
                          {category.subtopics.length > 3 && ` +${category.subtopics.length - 3} more`}
                        </div>
                      </div>

                      <div style={{ textAlign: "center", width: 80, flexShrink: 0 }}>
                        <div style={{ fontSize: 14, color: hasMultiple ? "#E2E4EC" : "#6B7280", fontWeight: hasMultiple ? 600 : 400 }}>{category.rows.length}</div>
                        <div style={{ fontSize: 9, color: "#4B5563" }}>report{category.rows.length !== 1 ? "s" : ""}</div>
                      </div>

                      <div style={{ textAlign: "right", width: 80, flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{formatMRR(category.totalMrr)}</div>
                      </div>

                      <div style={{ textAlign: "right", width: 90, flexShrink: 0 }}>
                        <div style={{ fontSize: 14, color: "#E2E4EC", fontWeight: 500 }}>{formatARR(category.totalArr)}</div>
                      </div>

                      <div style={{ width: 100, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                        <span className="badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexShrink: 0, width: 150 }} onClick={e => e.stopPropagation()}>
                        {groupStatus(category.rows) === "pending" && (
                          <button className="action-btn" onClick={() => handleSendToSlack(category)} style={{ background: "#1E2030", color: "#60A5FA", border: "1px solid #60A5FA30" }}>
                            → Slack
                          </button>
                        )}
                        <button className="action-btn" style={{ background: "#1E2030", color: "#4B5563", border: "1px solid #1E2030" }} title="Create Asana ticket (coming soon)">
                          + Asana
                        </button>
                      </div>
                    </div>

                    {isCategoryOpen && category.subtopics.map(subtopic => {
                      const subtopicKey = `${category.key}:${subtopic.key}`;
                      const isSubtopicOpen = !!expandedSubtopics[subtopicKey];
                      const ssc = statusConfig[groupStatus(subtopic.rows)];
                      const subtopicLatestDate = subtopic.rows.map(r => r.date).sort().reverse()[0];

                      return (
                        <div key={subtopicKey} style={{ background: "#0E0F14", borderTop: "1px solid #1A1B24" }}>
                          <div className="group-header" onClick={() => toggleSubtopic(subtopicKey)} style={{ cursor: "pointer", paddingLeft: "44px" }}>
                            <span className={`chevron ${isSubtopicOpen ? "open" : ""}`}>▶</span>

                            <div style={{ flex: 2, minWidth: 0 }}>
                              <div style={{ marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: "#C4C7D4", fontSize: 12, fontWeight: 500 }}>{subtopic.key}</span>
                                <span style={{ fontSize: 9, color: "#4B5563" }}>{subtopicLatestDate}</span>
                              </div>
                              <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                                {subtopic.rows.map(r => r.merchant).filter(m => m !== "Unknown").slice(0, 3).join(", ")}
                                {subtopic.rows.length > 3 ? ` +${subtopic.rows.length - 3} more` : ""}
                              </div>
                            </div>

                            <div style={{ textAlign: "center", width: 80, flexShrink: 0 }}>
                              <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>{subtopic.rows.length}</div>
                              <div style={{ fontSize: 9, color: "#4B5563" }}>report{subtopic.rows.length !== 1 ? "s" : ""}</div>
                            </div>

                            <div style={{ textAlign: "right", width: 80, flexShrink: 0 }}>
                              <div style={{ fontSize: 11, color: "#6B7280" }}>{formatMRR(subtopic.totalMrr)}</div>
                            </div>

                            <div style={{ textAlign: "right", width: 90, flexShrink: 0 }}>
                              <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>{formatARR(subtopic.totalArr)}</div>
                            </div>

                            <div style={{ width: 100, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                              <span className="badge" style={{ background: ssc.bg, color: ssc.color, fontSize: 9 }}>{ssc.label}</span>
                            </div>

                            <div style={{ width: 150, flexShrink: 0 }}></div>
                          </div>

                          {isSubtopicOpen && subtopic.rows.map(r => {
                      const msc = statusConfig[r.status] || statusConfig.pending;
                      const isSelected = selectedIds.has(r.id);
                      return (
                        <div key={r.id} className="merchant-sub-row" style={isSelected ? { background: "rgba(124,106,247,0.06)", borderLeft: "2px solid #7C6AF7" } : undefined}>
                          <div style={{ width: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect(r.id)}
                              style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#7C6AF7" }}
                            />
                          </div>
                          <div style={{ flex: 1.2, minWidth: 0 }}>
                            <div style={{ color: "#C4C7D4", fontSize: 11, fontWeight: 500 }}>{r.merchant !== "Unknown" ? r.merchant : "(merchant TBD)"}</div>
                            <div style={{ color: "#4B5563", fontSize: 10, marginTop: 1 }}>via {r.submittedBy || "Unknown"} · {r.date}</div>
                          </div>
                          <div style={{ flex: 2, minWidth: 0 }}>
                            {/* AI-derived context at top in white with scrollable container */}
                            {r.context && (
                              <div style={{
                                color: "#E2E4EC",
                                fontSize: 11,
                                lineHeight: 1.45,
                                marginBottom: 8,
                                maxHeight: "80px",
                                overflowY: "auto",
                                paddingRight: "4px"
                              }}>
                                {r.context}
                              </div>
                            )}
                            {/* Raw text at bottom in grey with scrollable container */}
                            <div style={{
                              color: "#6B7280",
                              fontSize: 10,
                              lineHeight: 1.4,
                              maxHeight: "60px",
                              overflowY: "auto",
                              paddingRight: "4px"
                            }}>
                              {r.request}
                            </div>
                          </div>
                          <div style={{ width: 100, flexShrink: 0 }}></div>
                          <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: "#6B7280" }}>{formatMRR(r.mrr)}</div>
                          </div>
                          <div style={{ width: 90, textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 12, color: "#C4C7D4" }}>{formatARR(r.arr)}</div>
                          </div>
                          <div style={{ width: 100, display: "flex", justifyContent: "center", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <select
                              value={r.status}
                              onChange={e => onStatusChange(r.id, e.target.value)}
                              style={{
                                background: msc.bg,
                                color: msc.color,
                                fontSize: 9,
                                fontWeight: 600,
                                border: `1px solid ${msc.color}30`,
                                borderRadius: 10,
                                padding: "2px 4px",
                                cursor: "pointer",
                                outline: "none",
                                appearance: "none",
                                WebkitAppearance: "none",
                                textAlign: "center",
                                lineHeight: 1.4,
                              }}
                            >
                              {Object.entries(statusConfig).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.label}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ width: 150, flexShrink: 0, display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                            {r.slackTs && (
                              <a
                                href={getSlackMessageUrl(r.slackTs, slackChannel)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-btn"
                                style={{ background: "#1E2030", color: "#60A5FA", border: "1px solid #60A5FA30", fontSize: 10, padding: "4px 8px", textDecoration: "none" }}
                                title="View in Slack"
                              >
                                Slack →
                              </a>
                            )}
                            <button
                              onClick={() => onEdit(r)}
                              className="action-btn"
                              style={{ background: "#1E2030", color: "#60A5FA", border: "1px solid #60A5FA30", fontSize: 10, padding: "4px 8px" }}
                              title="Edit request"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => onDelete(r)}
                              className="action-btn"
                              style={{ background: "#1E2030", color: "#EF4444", border: "1px solid #EF444430", fontSize: 10, padding: "4px 8px" }}
                              title="Delete request"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {section.groups.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#4B5563", fontSize: 12 }}>No requests match your filters.</div>
              )}
            </div>
          ))}

          {/* Completed Section */}
          {completedData.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div
                onClick={() => setCompletedExpanded(prev => !prev)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", cursor: "pointer", userSelect: "none" }}
              >
                <span className={`chevron ${completedExpanded ? "open" : ""}`} style={{ color: "#34D399" }}>▶</span>
                <span style={{ fontSize: 12, color: "#34D399", fontWeight: 600, letterSpacing: "0.04em" }}>Completed</span>
                <span className="badge" style={{ background: "rgba(52,211,153,0.12)", color: "#34D399" }}>{completedData.length}</span>
                <div style={{ flex: 1, height: 1, background: "#1E2030" }} />
              </div>

              {completedExpanded && (
                <div style={{ opacity: 0.7 }}>
                  {completedGrouped.map(category => {
                    const isCategoryOpen = !!expandedCompletedGroups[category.key];
                    const sc = statusConfig[groupStatus(category.rows)];
                    const hasMultiple = category.rows.length > 1;

                    return (
                      <div key={category.key} className="group-row">
                        <div className="group-header" onClick={() => toggleCompletedGroup(category.key)} style={{ cursor: "pointer" }}>
                          <span className={`chevron ${isCategoryOpen ? "open" : ""}`}>▶</span>

                          <div style={{ flex: 2, minWidth: 0 }}>
                            <div style={{ marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#E2E4EC", fontSize: 13, fontWeight: 600 }}>{category.key}</span>
                              <span style={{ fontSize: 9, color: "#4B5563" }}>{category.subtopics.length} subtopic{category.subtopics.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div style={{ fontSize: 10, color: "#6B7280" }}>
                              {category.subtopics.slice(0, 3).map(st => st.key).join(", ")}
                              {category.subtopics.length > 3 && ` +${category.subtopics.length - 3} more`}
                            </div>
                          </div>

                          <div style={{ textAlign: "center", width: 80, flexShrink: 0 }}>
                            <div style={{ fontSize: 14, color: hasMultiple ? "#E2E4EC" : "#6B7280", fontWeight: hasMultiple ? 600 : 400 }}>{category.rows.length}</div>
                            <div style={{ fontSize: 9, color: "#4B5563" }}>report{category.rows.length !== 1 ? "s" : ""}</div>
                          </div>

                          <div style={{ textAlign: "right", width: 80, flexShrink: 0 }}>
                            <div style={{ fontSize: 12, color: "#9CA3AF" }}>{formatMRR(category.totalMrr)}</div>
                          </div>

                          <div style={{ textAlign: "right", width: 90, flexShrink: 0 }}>
                            <div style={{ fontSize: 14, color: "#E2E4EC", fontWeight: 500 }}>{formatARR(category.totalArr)}</div>
                          </div>

                          <div style={{ width: 100, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                            <span className="badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </div>

                          <div style={{ width: 150, flexShrink: 0 }}></div>
                        </div>

                        {isCategoryOpen && category.subtopics.map(subtopic => {
                          const subtopicKey = `completed:${category.key}:${subtopic.key}`;
                          const isSubtopicOpen = !!expandedCompletedSubtopics[subtopicKey];
                          const ssc = statusConfig[groupStatus(subtopic.rows)];
                          const subtopicLatestDate = subtopic.rows.map(r => r.date).sort().reverse()[0];

                          return (
                            <div key={subtopicKey} style={{ background: "#0E0F14", borderTop: "1px solid #1A1B24" }}>
                              <div className="group-header" onClick={() => toggleCompletedSubtopic(subtopicKey)} style={{ cursor: "pointer", paddingLeft: "44px" }}>
                                <span className={`chevron ${isSubtopicOpen ? "open" : ""}`}>▶</span>

                                <div style={{ flex: 2, minWidth: 0 }}>
                                  <div style={{ marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ color: "#C4C7D4", fontSize: 12, fontWeight: 500 }}>{subtopic.key}</span>
                                    <span style={{ fontSize: 9, color: "#4B5563" }}>{subtopicLatestDate}</span>
                                  </div>
                                  <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                                    {subtopic.rows.map(r => r.merchant).filter(m => m !== "Unknown").slice(0, 3).join(", ")}
                                    {subtopic.rows.length > 3 ? ` +${subtopic.rows.length - 3} more` : ""}
                                  </div>
                                </div>

                                <div style={{ textAlign: "center", width: 80, flexShrink: 0 }}>
                                  <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>{subtopic.rows.length}</div>
                                  <div style={{ fontSize: 9, color: "#4B5563" }}>report{subtopic.rows.length !== 1 ? "s" : ""}</div>
                                </div>

                                <div style={{ textAlign: "right", width: 80, flexShrink: 0 }}>
                                  <div style={{ fontSize: 11, color: "#6B7280" }}>{formatMRR(subtopic.totalMrr)}</div>
                                </div>

                                <div style={{ textAlign: "right", width: 90, flexShrink: 0 }}>
                                  <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>{formatARR(subtopic.totalArr)}</div>
                                </div>

                                <div style={{ width: 100, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                                  <span className="badge" style={{ background: ssc.bg, color: ssc.color, fontSize: 9 }}>{ssc.label}</span>
                                </div>

                                <div style={{ width: 150, flexShrink: 0 }}></div>
                              </div>

                              {isSubtopicOpen && subtopic.rows.map(r => {
                                const msc = statusConfig[r.status] || statusConfig.pending;
                                const isSelected = selectedIds.has(r.id);
                                return (
                                  <div key={r.id} className="merchant-sub-row" style={isSelected ? { background: "rgba(124,106,247,0.06)", borderLeft: "2px solid #7C6AF7" } : undefined}>
                                    <div style={{ width: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => onToggleSelect(r.id)}
                                        style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#7C6AF7" }}
                                      />
                                    </div>
                                    <div style={{ flex: 1.2, minWidth: 0 }}>
                                      <div style={{ color: "#C4C7D4", fontSize: 11, fontWeight: 500 }}>{r.merchant !== "Unknown" ? r.merchant : "(merchant TBD)"}</div>
                                      <div style={{ color: "#4B5563", fontSize: 10, marginTop: 1 }}>via {r.submittedBy || "Unknown"} · {r.date}</div>
                                    </div>
                                    <div style={{ flex: 2, minWidth: 0 }}>
                                      {r.context && (
                                        <div style={{ color: "#E2E4EC", fontSize: 11, lineHeight: 1.45, marginBottom: 8, maxHeight: "80px", overflowY: "auto", paddingRight: "4px" }}>
                                          {r.context}
                                        </div>
                                      )}
                                      <div style={{ color: "#6B7280", fontSize: 10, lineHeight: 1.4, maxHeight: "60px", overflowY: "auto", paddingRight: "4px" }}>
                                        {r.request}
                                      </div>
                                    </div>
                                    <div style={{ width: 100, flexShrink: 0 }}></div>
                                    <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                                      <div style={{ fontSize: 11, color: "#6B7280" }}>{formatMRR(r.mrr)}</div>
                                    </div>
                                    <div style={{ width: 90, textAlign: "right", flexShrink: 0 }}>
                                      <div style={{ fontSize: 12, color: "#C4C7D4" }}>{formatARR(r.arr)}</div>
                                    </div>
                                    <div style={{ width: 100, display: "flex", justifyContent: "center", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                      <select
                                        value={r.status}
                                        onChange={e => onStatusChange(r.id, e.target.value)}
                                        style={{
                                          background: msc.bg, color: msc.color, fontSize: 9, fontWeight: 600,
                                          border: `1px solid ${msc.color}30`, borderRadius: 10, padding: "2px 4px",
                                          cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none",
                                          textAlign: "center", lineHeight: 1.4,
                                        }}
                                      >
                                        {Object.entries(statusConfig).map(([key, cfg]) => (
                                          <option key={key} value={key}>{cfg.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div style={{ width: 150, flexShrink: 0, display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                                      {r.slackTs && (
                                        <a
                                          href={getSlackMessageUrl(r.slackTs, slackChannel)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="action-btn"
                                          style={{ background: "#1E2030", color: "#60A5FA", border: "1px solid #60A5FA30", fontSize: 10, padding: "4px 8px", textDecoration: "none" }}
                                          title="View in Slack"
                                        >
                                          Slack →
                                        </a>
                                      )}
                                      <button onClick={() => onEdit(r)} className="action-btn" style={{ background: "#1E2030", color: "#60A5FA", border: "1px solid #60A5FA30", fontSize: 10, padding: "4px 8px" }} title="Edit request">✎</button>
                                      <button onClick={() => onDelete(r)} className="action-btn" style={{ background: "#1E2030", color: "#EF4444", border: "1px solid #EF444430", fontSize: 10, padding: "4px 8px" }} title="Delete request">×</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {subTab === "demand" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
            <div style={{ background: "#13141A", border: "1px solid #1E2030", borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>Requests by Category</div>
              {rollups.slice(0, 12).map(r => {
                const pct = Math.round((r.count / Math.max(...rollups.map(x => x.count))) * 100);
                const cc = categoryColors[r.cat] || "#9CA3AF";
                return (
                  <div key={r.cat} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: cc }}>{r.cat}</span>
                      <span style={{ fontSize: 12, color: "#E2E4EC", fontWeight: 500 }}>{r.count} request{r.count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="rollup-bar"><div className="rollup-bar-fill" style={{ width: `${pct}%`, background: cc }} /></div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "#4B5563" }}>{r.merchantCount} merchants</span>
                      {r.arr > 0 && <><span style={{ fontSize: 10, color: "#4B5563" }}>·</span><span style={{ fontSize: 10, color: "#4B5563" }}>{formatARR(r.arr)} ARR</span></>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: "#13141A", border: "1px solid #1E2030", borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>Top Requests by Volume</div>
              {[...grouped].sort((a, b) => b.rows.length - a.rows.length).slice(0, 10).map((g, i) => {
                const cc = categoryColors[g.category] || "#9CA3AF";
                return (
                  <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10, padding: "10px 14px", background: "#0E0F14", borderRadius: 6, border: "1px solid #1A1B24" }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#1E2030", width: 24, textAlign: "right", flexShrink: 0 }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ color: "#E2E4EC", fontSize: 11 }}>{g.key}</span>
                        <span className="badge" style={{ background: `${cc}15`, color: cc, fontSize: 9 }}>{g.rows.length}×</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#4B5563" }}>
                        {[...new Set(g.rows.map(r => r.submittedBy).filter(s => s && s !== "Unknown"))].slice(0, 3).join(", ") || "various"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{g.category}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submitters table */}
          <div style={{ background: "#13141A", border: "1px solid #1E2030", borderRadius: 8, padding: 24, marginTop: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>Submissions by Team Member</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1E2030" }}>
                  {["Submitted By", "Count", "Categories", "Status Breakdown"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#4B5563", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const byPerson = {};
                  data.forEach(r => {
                    const key = r.submittedBy && r.submittedBy !== "Unknown" ? r.submittedBy : "Unknown";
                    if (!byPerson[key]) byPerson[key] = { count: 0, cats: new Set(), statuses: {} };
                    byPerson[key].count++;
                    byPerson[key].cats.add(r.category);
                    byPerson[key].statuses[r.status] = (byPerson[key].statuses[r.status] || 0) + 1;
                  });
                  return Object.entries(byPerson).sort((a, b) => b[1].count - a[1].count).slice(0, 15).map(([name, v]) => (
                    <tr key={name} style={{ borderBottom: "1px solid #1A1B24" }}>
                      <td style={{ padding: "10px 12px", color: name === "Unknown" ? "#4B5563" : "#E2E4EC" }}>{name}</td>
                      <td style={{ padding: "10px 12px", color: "#9CA3AF", fontWeight: 500 }}>{v.count}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {[...v.cats].slice(0, 4).map(c => <span key={c} className="badge" style={{ background: `${categoryColors[c] || "#9CA3AF"}15`, color: categoryColors[c] || "#9CA3AF", fontSize: 9 }}>{c}</span>)}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {Object.entries(v.statuses).map(([s, cnt]) => (
                            <span key={s} className="badge" style={{ background: statusConfig[s]?.bg, color: statusConfig[s]?.color, fontSize: 9 }}>{cnt} {statusConfig[s]?.label}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating selection bar */}
      {selectedIds.size >= 1 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#13141A", border: "1px solid #7C6AF730", borderRadius: 8,
          padding: "10px 20px", display: "flex", alignItems: "center", gap: 12,
          zIndex: 100, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "fadeInUp 0.3s ease"
        }}>
          <span style={{ fontSize: 12, color: "#A78BFA", fontWeight: 500 }}>{selectedIds.size} selected</span>
          <button
            onClick={onOpenCombine}
            className="action-btn"
            style={{ background: "rgba(124,106,247,0.15)", color: "#A78BFA", border: "1px solid #7C6AF740", padding: "6px 14px", fontWeight: 500 }}
          >
            {selectedIds.size === 1 ? "Move to Topic" : "Combine"}
          </button>
          <button
            onClick={onClearSelection}
            className="action-btn"
            style={{ background: "#1E2030", color: "#6B7280", border: "1px solid #2A2C3A", padding: "6px 14px" }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Slack Modal */}
      {slackModal && (
        <div className="modal-overlay" onClick={() => setSlackModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#E2E4EC", marginBottom: 4 }}>Send to {slackChannel}</div>
            <div style={{ fontSize: 11, color: "#4B5563", marginBottom: 16 }}>
              {slackModal.group.rows.length} report{slackModal.group.rows.length > 1 ? "s" : ""} · {slackModal.group.key}
            </div>
            <div style={{ background: "#0E0F14", border: "1px solid #1E2030", borderRadius: 6, padding: 14, fontSize: 11, color: "#9CA3AF", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 20, fontFamily: "'DM Mono', monospace", maxHeight: 300, overflowY: "auto" }}>
              {slackModal.text}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setSlackModal(null)} style={{ background: "#1E2030", color: "#6B7280", border: "1px solid #2A2C3A", borderRadius: 5, padding: "8px 16px", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>Cancel</button>
              <button onClick={confirmSendToSlack} style={{ background: accentColor, color: "#fff", borderRadius: 5, padding: "8px 16px", fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>Confirm Send →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, signOut } = useAuth();
  const [activeChannel, setActiveChannel] = useState("ai");
  const [productData, setProductData] = useState(REQUESTS_DATA);
  const [aiData, setAiData]           = useState(AI_FEEDBACK_DATA);
  const [toastMsg, setToastMsg]       = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [aiDataLoading, setAiDataLoading] = useState(false);
  const [aiDataError, setAiDataError] = useState(null);
  const [productDataLoading, setProductDataLoading] = useState(false);
  const [productDataError, setProductDataError] = useState(null);

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [combineModalOpen, setCombineModalOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Selection state for combine
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Clear selection when switching channels
  useEffect(() => { clearSelection(); }, [activeChannel]);

  const toastTimerRef = useRef(null);

  const showToast = (msg, onUndo) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg({ msg, onUndo });
    toastTimerRef.current = setTimeout(() => setToastMsg(null), onUndo ? 5000 : 3500);
  };

  // Get unique topics for autocomplete
  const existingTopics = useMemo(() => {
    const allData = [...productData, ...aiData];
    const topics = allData
      .map(r => r.topic)
      .filter(Boolean)
      .filter((topic, index, self) => self.indexOf(topic) === index);
    return topics.sort();
  }, [productData, aiData]);

  // Delete request
  const handleDeleteRequest = async (id) => {
    try {
      const response = await fetch('/api/requests/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete request');
      }

      // Remove from local state
      if (activeChannel === 'product') {
        setProductData(prev => prev.filter(r => r.id !== id));
      } else {
        setAiData(prev => prev.filter(r => r.id !== id));
      }

      showToast('Request deleted successfully');
    } catch (error) {
      console.error('Error deleting request:', error);
      throw error;
    }
  };

  // Inline status change
  const handleStatusChange = async (id, status) => {
    // Capture previous status before updating so we can undo
    const allData = activeChannel === 'product' ? productData : aiData;
    const previousStatus = allData.find(r => r.id === id)?.status;

    try {
      const response = await fetch('/api/requests/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }

      const result = await response.json();
      const updatedRequest = result.data;

      if (activeChannel === 'product') {
        setProductData(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
      } else {
        setAiData(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
      }

      if (status === 'done' && previousStatus && previousStatus !== 'done') {
        showToast('Moved to Completed', () => handleStatusChange(id, previousStatus));
      } else {
        showToast('Status updated');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status');
    }
  };

  // Edit request
  const handleEditRequest = async (updateData) => {
    try {
      const response = await fetch('/api/requests/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update request');
      }

      const result = await response.json();
      const updatedRequest = result.data;

      // Update local state
      if (activeChannel === 'product') {
        setProductData(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
      } else {
        setAiData(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
      }

      showToast('Request updated successfully');
    } catch (error) {
      console.error('Error updating request:', error);
      throw error;
    }
  };

  // Combine entries
  const handleCombineEntries = async (ids, topic, category) => {
    const allData = activeChannel === 'product' ? productData : aiData;
    // Capture previous values for undo
    const previousValues = ids.map(id => {
      const entry = allData.find(r => r.id === id);
      return { id, topic: entry?.topic, category: entry?.category };
    });

    try {
      const body = { ids, topic };
      if (category) body.category = category;

      const response = await fetch('/api/requests/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to combine entries');
      }

      const result = await response.json();
      const updatedEntries = result.data;

      // Update local state
      const setData = activeChannel === 'product' ? setProductData : setAiData;
      setData(prev => prev.map(r => {
        const updated = updatedEntries.find(u => u.id === r.id);
        return updated || r;
      }));

      clearSelection();
      showToast(`Combined ${updatedEntries.length} entries under "${topic}"`, () => {
        // Undo: restore previous topic/category for each entry
        previousValues.forEach(async (pv) => {
          try {
            await fetch('/api/requests/edit', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ id: pv.id, topic: pv.topic || null, category: pv.category || undefined })
            });
          } catch (e) {
            console.error('Error undoing combine for', pv.id, e);
          }
        });
        // Revert local state
        setData(prev => prev.map(r => {
          const pv = previousValues.find(p => p.id === r.id);
          if (pv) return { ...r, topic: pv.topic, category: pv.category || r.category };
          return r;
        }));
        showToast('Combine undone');
      });
    } catch (error) {
      console.error('Error combining entries:', error);
      showToast('Failed to combine entries');
      throw error;
    }
  };

  // Get selected entry objects for the combine modal
  const selectedEntries = useMemo(() => {
    const allData = activeChannel === 'product' ? productData : aiData;
    return allData.filter(r => selectedIds.has(r.id));
  }, [selectedIds, activeChannel, productData, aiData]);

  // Fetch AI feedback data from database on mount
  useEffect(() => {
    const fetchAiData = async () => {
      setAiDataLoading(true);
      setAiDataError(null);
      try {
        const response = await fetch('/api/requests/ai');
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setAiData(data);
      } catch (error) {
        console.error('Error fetching AI feedback data:', error);
        setAiDataError(error.message);
        showToast(`Failed to load AI feedback: ${error.message}`);
      } finally {
        setAiDataLoading(false);
      }
    };

    fetchAiData();
  }, []);

  // Fetch product data from database on mount
  useEffect(() => {
    const fetchProductData = async () => {
      setProductDataLoading(true);
      setProductDataError(null);
      try {
        const response = await fetch('/api/requests/product');
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setProductData(data);
      } catch (error) {
        console.error('Error fetching product data:', error);
        setProductDataError(error.message);
        showToast(`Failed to load product data: ${error.message}`);
      } finally {
        setProductDataLoading(false);
      }
    };

    fetchProductData();
  }, []);

  const handleSync = () => {
    setSyncLoading(true);
    setTimeout(() => {
      setSyncLoading(false);
      showToast(`Synced ${activeChannel === "product" ? "#product" : "#ai-feedback"} — 0 new messages (demo)`);
    }, 1800);
  };

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", background: "#0E0F14", minHeight: "100vh", color: "#E2E4EC" }}>
      <style>{SHARED_CSS}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1E2030", padding: "0 32px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #7C6AF7, #A78BFA)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⬡</div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em", color: "#E2E4EC" }}>
              Tapcart <span style={{ color: "#7C6AF7" }}>Feature Request Board</span>
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleSync}
              style={{ background: "#1E2030", color: "#9CA3AF", border: "1px solid #2A2C3A", borderRadius: 5, padding: "6px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={syncLoading ? { display: "inline-block", animation: "spin 1s linear infinite" } : {}}>↻</span>
              {syncLoading ? "Syncing..." : "Sync Slack"}
            </button>

            {/* Channel indicators */}
            <div
              onClick={() => setActiveChannel("product")}
              style={{ background: activeChannel === "product" ? "rgba(52,211,153,0.1)" : "#1E2030", border: `1px solid ${activeChannel === "product" ? "#34D39940" : "#2A2C3A"}`, borderRadius: 5, padding: "6px 12px", fontSize: 11, color: activeChannel === "product" ? "#34D399" : "#6B7280", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", transition: "all 0.15s" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", display: "inline-block", animation: activeChannel === "product" ? "pulse-dot 2s infinite" : "none" }}></span>
              #product
            </div>

            <div
              onClick={() => setActiveChannel("ai")}
              style={{ background: activeChannel === "ai" ? "rgba(124,106,247,0.15)" : "#1E2030", border: `1px solid ${activeChannel === "ai" ? "#7C6AF750" : "#2A2C3A"}`, borderRadius: 5, padding: "6px 12px", fontSize: 11, color: activeChannel === "ai" ? "#A78BFA" : "#6B7280", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", transition: "all 0.15s" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C6AF7", display: "inline-block", animation: activeChannel === "ai" ? "pulse-dot 2s infinite" : "none" }}></span>
              #ai-feedback
            </div>

            {/* User profile */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, borderLeft: "1px solid #2A2C3A" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ fontSize: 11, color: "#E2E4EC", fontWeight: 500 }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: 9, color: "#6B7280" }}>{user?.email || ''}</div>
              </div>
              {user?.picture && (
                <img src={user.picture} alt="Profile" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #2A2C3A" }} />
              )}
              <button
                onClick={signOut}
                style={{ background: "#1E2030", color: "#9CA3AF", border: "1px solid #2A2C3A", borderRadius: 5, padding: "6px 10px", fontSize: 10, fontFamily: "'DM Mono', monospace", transition: "all 0.15s" }}
                onMouseOver={(e) => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.borderColor = "#3d1616"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "#9CA3AF"; e.currentTarget.style.borderColor = "#2A2C3A"; }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Channel tab bar */}
      <div style={{ background: "#0B0C12", borderBottom: "1px solid #1E2030" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", display: "flex", gap: 0 }}>
          <button
            className={`tab-btn ${activeChannel === "ai" ? "active" : ""}`}
            onClick={() => setActiveChannel("ai")}
            style={{ padding: "12px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}
          >
            # ai-feedback
            <span style={{ background: "rgba(124,106,247,0.2)", color: "#A78BFA", fontSize: 9, padding: "1px 6px", borderRadius: 10, letterSpacing: "0.05em" }}>AI PRO</span>
          </button>
          <button
            className={`tab-btn ${activeChannel === "product" ? "active" : ""}`}
            onClick={() => setActiveChannel("product")}
            style={{ padding: "12px 20px", fontSize: 13 }}
          >
            # product
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>

        {/* #product channel */}
        {activeChannel === "product" && (
          <div>
            <div style={{ padding: "18px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em" }}># product</span>
              <div style={{ flex: 1, height: 1, background: "#1E2030" }} />
              <span style={{ fontSize: 10, color: "#4B5563" }}>{productData.length} entries</span>
            </div>

            {/* Error state */}
            {productDataError && !productDataLoading && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: 16, marginTop: 16 }}>
                <div style={{ fontSize: 12, color: "#F87171", fontWeight: 500, marginBottom: 4 }}>Error loading data</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{productDataError}</div>
              </div>
            )}

            {!productDataError && (
              <RequestsPanel
                data={productData}
                setData={setProductData}
                showToast={showToast}
                slackChannel="#product"
                accentColor="#34D399"
                loading={productDataLoading}
                onDelete={(request) => {
                  setSelectedRequest(request);
                  setDeleteModalOpen(true);
                }}
                onEdit={(request) => {
                  setSelectedRequest(request);
                  setEditModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                isAiChannel={false}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onClearSelection={clearSelection}
                onOpenCombine={() => setCombineModalOpen(true)}
                onOpenAiSuggest={() => setSuggestModalOpen(true)}
              />
            )}
          </div>
        )}

        {/* #ai-feedback channel */}
        {activeChannel === "ai" && (
          <div>
            <div style={{ padding: "18px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: "#7C6AF7", textTransform: "uppercase", letterSpacing: "0.1em" }}># ai-feedback</span>
              <span style={{ background: "rgba(124,106,247,0.15)", color: "#A78BFA", fontSize: 9, padding: "2px 8px", borderRadius: 10, letterSpacing: "0.06em" }}>AI PRO FEEDBACK</span>
              <div style={{ flex: 1, height: 1, background: "#1E2030" }} />
              <span style={{ fontSize: 10, color: "#4B5563" }}>{aiData.length} entries</span>
            </div>

            {/* AI channel banner */}
            <div style={{ background: "linear-gradient(135deg, rgba(124,106,247,0.08), rgba(167,139,250,0.05))", border: "1px solid rgba(124,106,247,0.2)", borderRadius: 8, padding: "14px 20px", marginTop: 16, marginBottom: 4, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 32, height: 32, background: "rgba(124,106,247,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✦</div>
              <div>
                <div style={{ fontSize: 12, color: "#A78BFA", fontWeight: 500, marginBottom: 3 }}>AI Pro Feedback Channel</div>
                <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.5 }}>
                  Feedback and feature requests sourced from <strong style={{ color: "#9CA3AF" }}>#ai-feedback</strong>. Same schema as #product — grouped by request topic, sortable, and Asana/Slack-ready.
                </div>
              </div>
            </div>

            {/* Error state */}
            {aiDataError && !aiDataLoading && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: 16, marginTop: 16 }}>
                <div style={{ fontSize: 12, color: "#F87171", fontWeight: 500, marginBottom: 4 }}>Error loading data</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{aiDataError}</div>
              </div>
            )}

            {/* Data panel */}
            {!aiDataError && (
              <RequestsPanel
                data={aiData}
                setData={setAiData}
                showToast={showToast}
                slackChannel="#ai-feedback"
                accentColor="#7C6AF7"
                loading={aiDataLoading}
                onDelete={(request) => {
                  setSelectedRequest(request);
                  setDeleteModalOpen(true);
                }}
                onEdit={(request) => {
                  setSelectedRequest(request);
                  setEditModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                isAiChannel={true}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onClearSelection={clearSelection}
                onOpenCombine={() => setCombineModalOpen(true)}
                onOpenAiSuggest={() => setSuggestModalOpen(true)}
              />
            )}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>

      {toastMsg && (
        <div className="toast" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span><span style={{ color: "#34D399", marginRight: 6 }}>✓</span>{toastMsg.msg}</span>
          {toastMsg.onUndo && (
            <button
              onClick={() => { toastMsg.onUndo(); setToastMsg(null); }}
              style={{ background: "rgba(124,106,247,0.15)", color: "#A78BFA", border: "1px solid rgba(124,106,247,0.3)", borderRadius: 4, padding: "3px 10px", fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <DeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedRequest(null);
        }}
        onConfirm={handleDeleteRequest}
        request={selectedRequest}
      />

      <EditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedRequest(null);
        }}
        onSave={handleEditRequest}
        request={selectedRequest}
        existingTopics={existingTopics}
        isAiChannel={activeChannel === 'ai'}
      />

      <CombineModal
        isOpen={combineModalOpen}
        onClose={() => setCombineModalOpen(false)}
        onCombine={handleCombineEntries}
        selectedEntries={selectedEntries}
        existingTopics={existingTopics}
        isAiChannel={activeChannel === 'ai'}
      />

      <SuggestCombineModal
        isOpen={suggestModalOpen}
        onClose={() => setSuggestModalOpen(false)}
        onApply={handleCombineEntries}
        channel={activeChannel}
      />
    </div>
  );
}
