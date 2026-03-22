// Token Monitor — Übersicht widget
// Apple-quality UI: macOS Sequoia / SF Design System

export const command = `bash "$HOME/Library/Application Support/Übersicht/widgets/token-monitor/fetch-data.sh"`;

export const refreshFrequency = 60000;

const PREFS_FILE = "~/.token-monitor-prefs.json";

export const className = `
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;
  color: #e5e5ea;
  z-index: 1;
  width: 100%;
  height: 100%;
  position: relative;
  -webkit-font-smoothing: antialiased;
`;

// --- Constants ---

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_WIDTH = 320;
const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 48;
const MIN_WIDTH = 260;
const MAX_WIDTH = 1400;
const MIN_HEIGHT = 150;

// macOS system colors
const C = {
  blue: "#0A84FF",
  green: "#30D158",
  yellow: "#FFD60A",
  red: "#FF453A",
  orange: "#FF9F0A",
  purple: "#BF5AF2",
  secondaryLabel: "#8E8E93",
  tertiaryLabel: "#636366",
  separator: "rgba(255,255,255,0.1)",
  fillPrimary: "rgba(255,255,255,0.08)",
  fillSecondary: "rgba(255,255,255,0.05)",
};

// --- Helpers ---

function timeAgo(epoch) {
  if (!epoch) return "never";
  const secs = Math.floor(Date.now() / 1000) - epoch;
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function isStale(epoch) {
  if (!epoch) return true;
  return Math.floor(Date.now() / 1000) - epoch > 120;
}

function formatTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `today ${formatTime(isoStr)}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${formatTime(isoStr)}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + formatTime(isoStr);
}

function usageColor(pct) {
  if (pct >= 80) return C.red;
  if (pct >= 50) return C.yellow;
  return C.green;
}

function formatCost(v) {
  if (v == null) return "$0.00";
  if (v < 0.01 && v > 0) return "$" + v.toFixed(4);
  return "$" + v.toFixed(2);
}

function formatTokens(n) {
  if (n == null || n === 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function getTodayCost(data) {
  if (!data || !data.openclaw || !data.openclaw.today || !data.openclaw.today.api) return "$0.00";
  return formatCost(data.openclaw.today.api.totalCost);
}

// --- Drag / resize state ---

let _dragState = null;
let _dispatch = null;
let _currentPrefs = {};

function persistPrefs(prefs) {
  try {
    const run = require("child_process").execSync;
    run(`echo '${JSON.stringify(prefs)}' > $HOME/.token-monitor-prefs.json`);
  } catch (e) {}
}

function handleDocMouseMove(e) {
  if (!_dragState) return;
  if (_dragState.type === "move") {
    const dx = e.clientX - _dragState.startX;
    const dy = e.clientY - _dragState.startY;
    _dragState.element.style.left = (_dragState.startLeft + dx) + "px";
    _dragState.element.style.top = (_dragState.startTop + dy) + "px";
  } else if (_dragState.type === "resize") {
    const dx = e.clientX - _dragState.startX;
    const dy = e.clientY - _dragState.startY;
    const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, _dragState.startWidth + dx));
    const newH = Math.max(MIN_HEIGHT, _dragState.startHeight + dy);
    _dragState.element.style.width = newW + "px";
    _dragState.element.style.height = newH + "px";
  }
}

function handleDocMouseUp(e) {
  if (!_dragState) return;
  const el = _dragState.element;
  if (_dragState.type === "move") {
    const left = parseInt(el.style.left) || 0;
    const top = parseInt(el.style.top) || 0;
    if (_dispatch) _dispatch({ type: "SET_POSITION", top, left });
    const prefs = { ..._currentPrefs, top, left };
    _currentPrefs = prefs;
    persistPrefs(prefs);
  } else if (_dragState.type === "resize") {
    const width = parseInt(el.style.width) || DEFAULT_WIDTH;
    const height = parseInt(el.style.height) || null;
    if (_dispatch) {
      _dispatch({ type: "SET_WIDTH", width });
      if (height) _dispatch({ type: "SET_HEIGHT", height });
    }
    const prefs = { ..._currentPrefs, width, height };
    _currentPrefs = prefs;
    persistPrefs(prefs);
  }
  _dragState = null;
  document.removeEventListener("mousemove", handleDocMouseMove);
  document.removeEventListener("mouseup", handleDocMouseUp);
}

// --- Styles ---

function getStyles(fontSize, width) {
  const fs = fontSize;
  return {
    // Main container — ultra-thin material blur
    container: {
      position: "absolute",
      background: "rgba(28,28,30,0.85)",
      backdropFilter: "blur(40px) saturate(180%)",
      WebkitBackdropFilter: "blur(40px) saturate(180%)",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.3), inset 0 0.5px 0 rgba(255,255,255,0.08)",
      width: width,
      minWidth: MIN_WIDTH,
      maxWidth: MAX_WIDTH,
      overflow: "hidden",
      fontSize: fs,
      userSelect: "none",
      WebkitUserSelect: "none",
      transition: "height 200ms ease-out, opacity 200ms ease-out",
    },

    // Title bar
    titleBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 14px",
      cursor: "grab",
      position: "relative",
    },
    titleBarLeft: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      flexShrink: 0,
    },
    titleText: {
      fontSize: 13,
      fontWeight: 600,
      color: "#fff",
      letterSpacing: "-0.1px",
    },
    titleBarRight: {
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
    collapsedCost: {
      fontSize: 12,
      fontWeight: 500,
      color: C.green,
      fontVariantNumeric: "tabular-nums",
      marginRight: 4,
    },
    windowBtn: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      border: "none",
      background: "rgba(255,255,255,0.06)",
      color: C.secondaryLabel,
      fontSize: 13,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      lineHeight: 1,
      opacity: 0,
      transition: "opacity 150ms ease, background 150ms ease",
    },
    windowBtnVisible: {
      opacity: 1,
    },

    // Content area
    content: {
      padding: "0 14px 14px",
      transition: "opacity 200ms ease-out",
    },

    // Section headers
    sectionHeader: {
      fontSize: 11,
      fontWeight: 600,
      color: C.secondaryLabel,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      marginBottom: 8,
      marginTop: 2,
      cursor: "default",
      transition: "color 150ms ease",
    },

    // Hairline divider
    divider: {
      height: 0.5,
      background: C.separator,
      margin: "12px 0",
    },

    // Data rows
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
      lineHeight: "18px",
    },
    label: {
      color: C.secondaryLabel,
      fontSize: fs - 1,
    },
    value: {
      fontWeight: 500,
      fontSize: fs - 1,
      fontVariantNumeric: "tabular-nums",
    },

    // Progress bars — 4px rounded pill
    bar: {
      height: 4,
      borderRadius: 2,
      background: C.fillPrimary,
      marginTop: 4,
      marginBottom: 6,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 2,
      transition: "width 0.4s ease",
    },

    // Segmented control (time range toggle)
    segmented: {
      display: "flex",
      gap: 0,
      marginBottom: 10,
      background: C.fillSecondary,
      borderRadius: 8,
      padding: 2,
    },
    segment: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: 500,
      padding: "4px 0",
      borderRadius: 6,
      cursor: "pointer",
      color: C.tertiaryLabel,
      transition: "all 150ms ease",
    },
    segmentActive: {
      background: "rgba(255,255,255,0.14)",
      color: "#fff",
    },

    // Model rows
    modelRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 3,
      fontSize: fs - 1,
      lineHeight: "16px",
    },
    modelName: {
      color: "#aaa",
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      marginRight: 8,
    },
    modelTokens: {
      color: C.tertiaryLabel,
      fontVariantNumeric: "tabular-nums",
      marginRight: 8,
      fontSize: fs - 2,
    },
    modelCost: {
      color: "#e5e5ea",
      fontWeight: 500,
      fontVariantNumeric: "tabular-nums",
      minWidth: 44,
      textAlign: "right",
    },

    // Error / caption text
    errorText: {
      color: C.tertiaryLabel,
      fontSize: fs - 1,
      fontStyle: "italic",
    },
    caption: {
      fontSize: 11,
      color: C.tertiaryLabel,
    },

    // Resize handle
    resizeHandle: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 16,
      height: 16,
      cursor: "nwse-resize",
      zIndex: 10,
      opacity: 0,
      transition: "opacity 150ms ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 9,
      color: C.tertiaryLabel,
    },

    // Updated badge
    badge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "1px 6px",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: "0.2px",
    },

    // Font size buttons
    sizeBtn: {
      width: 22,
      height: 22,
      borderRadius: 6,
      border: "none",
      background: C.fillPrimary,
      color: C.secondaryLabel,
      fontSize: 12,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      lineHeight: 1,
    },
  };
}

// --- Components ---

function StatusDot({ data, s }) {
  let color = C.green;
  if (!data || data.claudeError) color = C.red;
  else if (isStale(data.fetchedAt)) color = C.yellow;
  return <div style={{ ...s.statusDot, background: color, boxShadow: `0 0 6px ${color}44` }} />;
}

function UpdatedBadge({ data, s }) {
  if (!data) return null;
  const stale = isStale(data.fetchedAt);
  const color = stale ? C.yellow : C.tertiaryLabel;
  return (
    <span style={{ ...s.caption, color }}>
      Updated {data.fetchedAt ? timeAgo(data.fetchedAt) : "never"}
    </span>
  );
}

function UsageBar({ label, pct, resetsAt, s }) {
  const color = usageColor(pct);
  const remaining = Math.max(0, 100 - pct);
  return (
    <div>
      <div style={s.row}>
        <span style={s.label}>{label}</span>
        <span style={{ ...s.value, color }}>
          {pct}% · {remaining}% left
        </span>
      </div>
      <div style={s.bar}>
        <div style={{ ...s.barFill, width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      {resetsAt && (
        <div style={{ ...s.caption, marginBottom: 2 }}>
          Resets {formatDate(resetsAt)}
        </div>
      )}
    </div>
  );
}

function SegmentedControl({ range, onRangeChange, s }) {
  const ranges = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7D" },
    { key: "all", label: "All" },
  ];
  return (
    <div style={s.segmented}>
      {ranges.map((r) => (
        <div
          key={r.key}
          style={{ ...s.segment, ...(range === r.key ? s.segmentActive : {}) }}
          onClick={() => onRangeChange(r.key)}
        >
          {r.label}
        </div>
      ))}
    </div>
  );
}

function ClaudePanel({ data, error, s }) {
  if (error && !data) {
    return (
      <div>
        <div style={s.sectionHeader}>CLAUDE CODE</div>
        <div style={s.errorText}>{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <div style={s.sectionHeader}>CLAUDE CODE</div>
        <span style={{ ...s.badge, background: "rgba(142,142,147,0.15)", color: C.secondaryLabel }}>
          Offline
        </span>
      </div>
    );
  }

  const buckets = [];
  if (data.five_hour) buckets.push({ label: "5-Hour", ...data.five_hour });
  if (data.seven_day) buckets.push({ label: "7-Day", ...data.seven_day });
  if (data.seven_day_sonnet) buckets.push({ label: "Sonnet 7D", ...data.seven_day_sonnet });
  if (data.seven_day_opus) buckets.push({ label: "Opus 7D", ...data.seven_day_opus });
  if (data.seven_day_oauth_apps) buckets.push({ label: "OAuth 7D", ...data.seven_day_oauth_apps });
  if (data.seven_day_cowork) buckets.push({ label: "Cowork 7D", ...data.seven_day_cowork });
  if (data.iguana_necktie) buckets.push({ label: "Iguana", ...data.iguana_necktie });

  const extra = data.extra_usage;
  const rateLimited = data.is_rate_limited;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={s.sectionHeader}>CLAUDE CODE</div>
        {rateLimited && (
          <span style={{ ...s.badge, background: "rgba(255,159,10,0.15)", color: C.orange, marginBottom: 8 }}>
            Rate Limited
          </span>
        )}
      </div>
      {buckets.map((b, i) => (
        <UsageBar key={i} label={b.label} pct={b.utilization} resetsAt={b.resets_at} s={s} />
      ))}
      {extra && extra.is_enabled && (
        <div style={{ ...s.row, marginTop: 4 }}>
          <span style={s.label}>Extra usage</span>
          <span style={s.value}>
            {formatCost(extra.used_credits)} / {formatCost(extra.monthly_limit)}
          </span>
        </div>
      )}
    </div>
  );
}

function OpenClawAPIPanel({ data, error, range, onRangeChange, s }) {
  const rangeData = data && data[range];
  const apiData = rangeData && rangeData.api;

  return (
    <div>
      <div style={s.sectionHeader}>API SPEND</div>
      <SegmentedControl range={range} onRangeChange={onRangeChange} s={s} />
      {error && !apiData ? (
        <div style={s.errorText}>{error}</div>
      ) : !apiData ? (
        <div style={s.errorText}>No API usage data</div>
      ) : (
        <div>
          <div style={s.row}>
            <span style={s.label}>Total cost</span>
            <span style={{ ...s.value, color: "#e5e5ea" }}>
              {formatCost(apiData.totalCost != null ? apiData.totalCost : apiData.total_cost)}
            </span>
          </div>
          <div style={{ ...s.bar, marginTop: 6 }}>
            <div style={{ ...s.barFill, width: "100%", background: C.purple, opacity: 0.6 }} />
          </div>
          {apiData.models && apiData.models.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {apiData.models.map((m, i) => (
                <div key={i} style={s.modelRow}>
                  <span style={s.modelName}>
                    {m.provider === "local" ? "" : m.provider + "/"}{m.model}
                  </span>
                  <span style={s.modelTokens}>
                    {formatTokens(m.input_tokens || m.inputTokens)}↑ {formatTokens(m.output_tokens || m.outputTokens)}↓
                  </span>
                  <span style={s.modelCost}>{formatCost(m.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LocalMLXPanel({ data, error, range, onRangeChange, s }) {
  const rangeData = data && data[range];
  const localData = rangeData && rangeData.local;

  return (
    <div>
      <div style={s.sectionHeader}>LOCAL MLX</div>
      <SegmentedControl range={range} onRangeChange={onRangeChange} s={s} />
      {error && !localData ? (
        <div style={s.errorText}>{error}</div>
      ) : !localData || !localData.models || localData.models.length === 0 ? (
        <div style={s.errorText}>No local model usage</div>
      ) : (
        <div>
          {localData.models.map((m, i) => (
            <div key={i} style={s.modelRow}>
              <span style={s.modelName}>{m.model}</span>
              <span style={s.modelTokens}>
                {formatTokens(m.input_tokens || m.inputTokens)}↑ {formatTokens(m.output_tokens || m.outputTokens)}↓
              </span>
              <span style={{ ...s.modelCost, color: C.green }}>free</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- State ---

export const initialState = {
  data: null,
  apiRange: "today",
  localRange: "today",
  fontSize: DEFAULT_FONT_SIZE,
  width: DEFAULT_WIDTH,
  height: null,
  top: null,
  left: null,
  collapsed: false,
  prefsLoaded: false,
};

export const updateState = (event, prevState) => {
  if (event.type === "UB/COMMAND_RAN") {
    try {
      const data = JSON.parse(event.output);
      const next = { ...prevState, data };
      if (!prevState.prefsLoaded && data.prefs) {
        if (data.prefs.fontSize) next.fontSize = data.prefs.fontSize;
        if (data.prefs.width) next.width = data.prefs.width;
        if (data.prefs.height) next.height = data.prefs.height;
        if (data.prefs.top != null) next.top = data.prefs.top;
        if (data.prefs.left != null) next.left = data.prefs.left;
        if (data.prefs.collapsed != null) next.collapsed = data.prefs.collapsed;
        next.prefsLoaded = true;
      }
      return next;
    } catch (e) {
      return prevState;
    }
  }
  if (event.type === "SET_API_RANGE") return { ...prevState, apiRange: event.range };
  if (event.type === "SET_LOCAL_RANGE") return { ...prevState, localRange: event.range };
  if (event.type === "SET_FONT_SIZE") return { ...prevState, fontSize: event.fontSize };
  if (event.type === "SET_WIDTH") return { ...prevState, width: event.width };
  if (event.type === "SET_HEIGHT") return { ...prevState, height: event.height };
  if (event.type === "SET_POSITION") return { ...prevState, top: event.top, left: event.left };
  if (event.type === "TOGGLE_COLLAPSE") return { ...prevState, collapsed: !prevState.collapsed };
  return prevState;
};

// --- Render ---

export const render = ({ data, apiRange, localRange, fontSize, width, height, top, left, collapsed }, dispatch) => {
  const fs = fontSize || DEFAULT_FONT_SIZE;
  const w = width || DEFAULT_WIDTH;
  const s = getStyles(fs, w);

  const currentTop = top != null ? top : 20;
  const currentLeft = left != null ? left : (typeof window !== "undefined" ? window.innerWidth - w - 20 : 20);

  _dispatch = dispatch;
  _currentPrefs = { fontSize: fs, width: w, height, top: currentTop, left: currentLeft, collapsed: !!collapsed };

  const toggleCollapse = () => {
    dispatch({ type: "TOGGLE_COLLAPSE" });
    const prefs = { ..._currentPrefs, collapsed: !collapsed };
    _currentPrefs = prefs;
    persistPrefs(prefs);
  };

  const changeFontSize = (delta) => {
    const step = fs >= 18 ? 2 : 1;
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fs + delta * step));
    if (next !== fs) {
      dispatch({ type: "SET_FONT_SIZE", fontSize: next });
      const prefs = { ..._currentPrefs, fontSize: next };
      _currentPrefs = prefs;
      persistPrefs(prefs);
    }
  };

  const containerStyle = {
    ...s.container,
    top: currentTop,
    left: currentLeft,
  };
  if (!collapsed && height) {
    containerStyle.height = height;
    containerStyle.overflow = "auto";
  }

  const onContainerMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("[data-clickable]") || e.target.dataset.resize) return;
    const el = e.currentTarget;
    _dragState = {
      type: "move",
      startX: e.clientX,
      startY: e.clientY,
      startTop: parseInt(el.style.top) || currentTop,
      startLeft: parseInt(el.style.left) || currentLeft,
      element: el,
    };
    el.style.cursor = "grabbing";
    e.preventDefault();
    document.addEventListener("mousemove", handleDocMouseMove);
    document.addEventListener("mouseup", function onUp(e) {
      document.removeEventListener("mouseup", onUp);
      if (_dragState && _dragState.element) {
        _dragState.element.style.cursor = "grab";
      }
      handleDocMouseUp(e);
    });
  };

  const onResizeMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const container = e.target.closest("[data-widget-root]");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    _dragState = {
      type: "resize",
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      element: container,
    };
    document.addEventListener("mousemove", handleDocMouseMove);
    document.addEventListener("mouseup", function onUp(e) {
      document.removeEventListener("mouseup", onUp);
      handleDocMouseUp(e);
    });
  };

  // --- Collapsed state: pill-shaped title bar only ---
  if (collapsed) {
    return (
      <div
        data-widget-root="true"
        style={{
          ...containerStyle,
          borderRadius: 20,
          height: 36,
          width: "auto",
          minWidth: 200,
          maxWidth: 400,
        }}
        onMouseDown={onContainerMouseDown}
      >
        <div
          style={{
            ...s.titleBar,
            padding: "7px 14px",
          }}
          onMouseEnter={(e) => {
            const btns = e.currentTarget.querySelectorAll("[data-window-btn]");
            btns.forEach(b => b.style.opacity = "1");
          }}
          onMouseLeave={(e) => {
            const btns = e.currentTarget.querySelectorAll("[data-window-btn]");
            btns.forEach(b => b.style.opacity = "0");
          }}
        >
          <div style={s.titleBarLeft}>
            <StatusDot data={data} s={s} />
            <span style={{ ...s.titleText, fontSize: 12 }}>Token Monitor</span>
          </div>
          <div style={s.titleBarRight}>
            <span style={s.collapsedCost}>{getTodayCost(data)}</span>
            <button
              data-window-btn="true"
              style={s.windowBtn}
              onClick={toggleCollapse}
              title="Expand"
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Expanded state ---
  if (!data) {
    return (
      <div data-widget-root="true" style={containerStyle} onMouseDown={onContainerMouseDown}>
        <div style={s.titleBar}>
          <div style={s.titleBarLeft}>
            <StatusDot data={null} s={s} />
            <span style={s.titleText}>Token Monitor</span>
          </div>
        </div>
        <div style={s.content}>
          <div style={s.errorText}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-widget-root="true"
      style={containerStyle}
      onMouseDown={onContainerMouseDown}
      onMouseEnter={(e) => {
        const rh = e.currentTarget.querySelector("[data-resize]");
        if (rh) rh.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const rh = e.currentTarget.querySelector("[data-resize]");
        if (rh) rh.style.opacity = "0";
      }}
    >
      {/* Title bar */}
      <div
        style={s.titleBar}
        onMouseEnter={(e) => {
          const btns = e.currentTarget.querySelectorAll("[data-window-btn]");
          btns.forEach(b => b.style.opacity = "1");
        }}
        onMouseLeave={(e) => {
          const btns = e.currentTarget.querySelectorAll("[data-window-btn]");
          btns.forEach(b => b.style.opacity = "0");
        }}
      >
        <div style={s.titleBarLeft}>
          <StatusDot data={data} s={s} />
          <span style={s.titleText}>Token Monitor</span>
        </div>
        <div style={s.titleBarRight}>
          <UpdatedBadge data={data} s={s} />
          <button
            data-window-btn="true"
            style={s.windowBtn}
            onClick={toggleCollapse}
            title="Minimize"
          >
            −
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Font size controls */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginBottom: 10 }}>
          <button style={s.sizeBtn} onClick={() => changeFontSize(-1)} title="Decrease font size">−</button>
          <span style={{ ...s.caption, minWidth: 16, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{fs}</span>
          <button style={s.sizeBtn} onClick={() => changeFontSize(1)} title="Increase font size">+</button>
        </div>

        <ClaudePanel data={data.claude} error={data.claudeError} s={s} />

        <div style={s.divider} />

        <OpenClawAPIPanel
          data={data.openclaw}
          error={data.openclawError}
          range={apiRange}
          onRangeChange={(r) => dispatch({ type: "SET_API_RANGE", range: r })}
          s={s}
        />

        <div style={s.divider} />

        <LocalMLXPanel
          data={data.openclaw}
          error={data.openclawError}
          range={localRange}
          onRangeChange={(r) => dispatch({ type: "SET_LOCAL_RANGE", range: r })}
          s={s}
        />
      </div>

      {/* Resize handle */}
      <div
        data-resize="true"
        style={s.resizeHandle}
        onMouseDown={onResizeMouseDown}
      >
        ⊕
      </div>
    </div>
  );
};
