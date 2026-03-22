// Token Monitor — Übersicht widget
// Shows Claude Code subscription usage, OpenClaw API spend, and local MLX usage

export const command = `bash "$HOME/Library/Application Support/Übersicht/widgets/token-monitor/fetch-data.sh"`;

export const refreshFrequency = 60000; // 60 seconds

const PREFS_FILE = "~/.token-monitor-prefs.json";

export const className = `
  top: 20px;
  right: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  color: #e0e0e0;
  z-index: 1;
`;

// --- Helpers ---

function timeAgo(epoch) {
  if (!epoch) return "never";
  const secs = Math.floor(Date.now() / 1000) - epoch;
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
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
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (isToday) return `today ${formatTime(isoStr)}`;
  if (isTomorrow) return `tomorrow ${formatTime(isoStr)}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + formatTime(isoStr);
}

function usageColor(pct) {
  if (pct >= 80) return "#ff5f57";
  if (pct >= 50) return "#febc2e";
  return "#28c840";
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

// --- Dynamic styles factory ---

function getStyles(fontSize, width) {
  return {
    container: {
      background: "rgba(30, 30, 30, 0.88)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "14px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      width: width,
      minWidth: 260,
      maxWidth: 1400,
      resize: "horizontal",
      overflow: "auto",
      fontSize: fontSize,
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      fontSize: fontSize + 1,
      fontWeight: 600,
      color: "#fff",
      letterSpacing: "-0.2px",
    },
    headerRight: {
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
    sizeBtn: {
      background: "rgba(255,255,255,0.08)",
      border: "none",
      borderRadius: 4,
      color: "#999",
      fontSize: fontSize - 1,
      width: 20,
      height: 20,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      padding: 0,
    },
    lastUpdated: {
      fontSize: fontSize - 2,
      color: "#666",
    },
    section: {
      marginBottom: 12,
    },
    sectionLast: {
      marginBottom: 0,
    },
    sectionTitle: {
      fontSize: fontSize - 2,
      fontWeight: 600,
      color: "#888",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      marginBottom: 6,
    },
    divider: {
      height: 1,
      background: "rgba(255,255,255,0.06)",
      margin: "10px 0",
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 3,
      lineHeight: "18px",
    },
    label: {
      color: "#999",
      fontSize: fontSize - 1,
    },
    value: {
      fontWeight: 500,
      fontSize: fontSize - 1,
      fontVariantNumeric: "tabular-nums",
    },
    bar: {
      height: 4,
      borderRadius: 2,
      background: "rgba(255,255,255,0.08)",
      marginTop: 4,
      marginBottom: 6,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 2,
      transition: "width 0.3s ease",
    },
    errorText: {
      color: "#888",
      fontSize: fontSize - 1,
      fontStyle: "italic",
    },
    tabs: {
      display: "flex",
      gap: 0,
      marginBottom: 8,
      background: "rgba(255,255,255,0.04)",
      borderRadius: 6,
      padding: 2,
    },
    tab: {
      flex: 1,
      textAlign: "center",
      fontSize: fontSize - 2,
      padding: "3px 0",
      borderRadius: 4,
      cursor: "pointer",
      color: "#777",
      fontWeight: 500,
    },
    tabActive: {
      background: "rgba(255,255,255,0.1)",
      color: "#e0e0e0",
    },
    modelRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 2,
      fontSize: fontSize - 1,
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
      color: "#999",
      fontVariantNumeric: "tabular-nums",
      marginRight: 8,
      fontSize: fontSize - 2,
    },
    modelCost: {
      color: "#e0e0e0",
      fontWeight: 500,
      fontVariantNumeric: "tabular-nums",
      minWidth: 44,
      textAlign: "right",
    },
  };
}

// --- Usage Bar Component ---

function UsageBar({ label, pct, resetsAt, s }) {
  const color = usageColor(pct);
  const remaining = Math.max(0, 100 - pct);
  return (
    <div>
      <div style={s.row}>
        <span style={s.label}>{label}</span>
        <span style={{ ...s.value, color }}>
          {pct}% used · {remaining}% left
        </span>
      </div>
      <div style={s.bar}>
        <div style={{ ...s.barFill, width: `${pct}%`, background: color }} />
      </div>
      {resetsAt && (
        <div style={{ ...s.label, fontSize: s.label.fontSize - 1, marginBottom: 2 }}>
          Resets {formatDate(resetsAt)}
        </div>
      )}
    </div>
  );
}

// --- Claude Panel ---

function ClaudePanel({ data, error, s }) {
  if (error && !data) {
    return (
      <div style={s.section}>
        <div style={s.sectionTitle}>Claude Code</div>
        <div style={s.errorText}>{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={s.section}>
        <div style={s.sectionTitle}>Claude Code</div>
        <div style={s.errorText}>No data</div>
      </div>
    );
  }

  const buckets = [];
  if (data.five_hour) buckets.push({ label: "5-Hour", ...data.five_hour });
  if (data.seven_day) buckets.push({ label: "7-Day", ...data.seven_day });
  if (data.seven_day_sonnet) buckets.push({ label: "7-Day Sonnet", ...data.seven_day_sonnet });
  if (data.seven_day_opus) buckets.push({ label: "7-Day Opus", ...data.seven_day_opus });
  if (data.seven_day_oauth_apps) buckets.push({ label: "7-Day OAuth", ...data.seven_day_oauth_apps });
  if (data.seven_day_cowork) buckets.push({ label: "7-Day Cowork", ...data.seven_day_cowork });
  if (data.iguana_necktie) buckets.push({ label: "Iguana", ...data.iguana_necktie });

  const extra = data.extra_usage;

  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>Claude Code</div>
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

// --- OpenClaw API Panel ---

function OpenClawAPIPanel({ data, error, range, onRangeChange, s }) {
  const rangeData = data && data[range];
  const apiData = rangeData && rangeData.api;

  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>OpenClaw API Spend</div>
      <RangeTabs range={range} onRangeChange={onRangeChange} s={s} />
      {error && !apiData ? (
        <div style={s.errorText}>{error}</div>
      ) : !apiData ? (
        <div style={s.errorText}>No API usage data</div>
      ) : (
        <div>
          <div style={s.row}>
            <span style={s.label}>Total cost</span>
            <span style={{ ...s.value, color: "#e0e0e0" }}>
              {formatCost(apiData.totalCost != null ? apiData.totalCost : apiData.total_cost)}
            </span>
          </div>
          {apiData.models && apiData.models.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {apiData.models.map((m, i) => (
                <div key={i} style={s.modelRow}>
                  <span style={s.modelName}>
                    {m.provider}/{m.model}
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

// --- Local MLX Panel ---

function LocalMLXPanel({ data, error, range, onRangeChange, s }) {
  const rangeData = data && data[range];
  const localData = rangeData && rangeData.local;

  return (
    <div style={s.sectionLast}>
      <div style={s.sectionTitle}>Local MLX</div>
      <RangeTabs range={range} onRangeChange={onRangeChange} s={s} />
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
              <span style={{ ...s.modelCost, color: "#28c840" }}>free</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Range Tabs ---

function RangeTabs({ range, onRangeChange, s }) {
  const ranges = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 Days" },
    { key: "all", label: "All Time" },
  ];
  return (
    <div style={s.tabs}>
      {ranges.map((r) => (
        <div
          key={r.key}
          style={{ ...s.tab, ...(range === r.key ? s.tabActive : {}) }}
          onClick={() => onRangeChange(r.key)}
        >
          {r.label}
        </div>
      ))}
    </div>
  );
}

// --- Main Widget ---

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_WIDTH = 340;
const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 48;
const MIN_WIDTH = 260;
const MAX_WIDTH = 1400;
const WIDTH_STEP = 40;

export const initialState = {
  data: null,
  apiRange: "today",
  localRange: "today",
  fontSize: DEFAULT_FONT_SIZE,
  width: DEFAULT_WIDTH,
  prefsLoaded: false,
};

export const updateState = (event, prevState) => {
  if (event.type === "UB/COMMAND_RAN") {
    try {
      const data = JSON.parse(event.output);
      const next = { ...prevState, data };
      // Apply saved prefs on first load
      if (!prevState.prefsLoaded && data.prefs) {
        if (data.prefs.fontSize) next.fontSize = data.prefs.fontSize;
        if (data.prefs.width) next.width = data.prefs.width;
        next.prefsLoaded = true;
      }
      return next;
    } catch (e) {
      return prevState;
    }
  }
  if (event.type === "SET_API_RANGE") {
    return { ...prevState, apiRange: event.range };
  }
  if (event.type === "SET_LOCAL_RANGE") {
    return { ...prevState, localRange: event.range };
  }
  if (event.type === "SET_FONT_SIZE") {
    return { ...prevState, fontSize: event.fontSize };
  }
  if (event.type === "SET_WIDTH") {
    return { ...prevState, width: event.width };
  }
  return prevState;
};

export const render = ({ data, apiRange, localRange, fontSize, width }, dispatch) => {
  const fs = fontSize || DEFAULT_FONT_SIZE;
  const w = width || DEFAULT_WIDTH;
  const s = getStyles(fs, w);

  const persistPrefs = (prefs) => {
    try {
      const run = require("child_process").execSync;
      run(`echo '${JSON.stringify(prefs)}' > $HOME/.token-monitor-prefs.json`);
    } catch (e) {}
  };

  const changeFontSize = (delta) => {
    const step = fs >= 18 ? 2 : 1;
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fs + delta * step));
    if (next !== fs) {
      dispatch({ type: "SET_FONT_SIZE", fontSize: next });
      persistPrefs({ fontSize: next, width: w });
    }
  };

  const changeWidth = (delta) => {
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w + delta * WIDTH_STEP));
    if (next !== w) {
      dispatch({ type: "SET_WIDTH", width: next });
      persistPrefs({ fontSize: fs, width: next });
    }
  };

  if (!data) {
    return (
      <div style={s.container}>
        <div style={s.header}>
          <span style={s.title}>Token Monitor</span>
        </div>
        <div style={s.errorText}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Token Monitor</span>
        <div style={s.headerRight}>
          <button style={s.sizeBtn} onClick={() => changeWidth(-1)} title="Decrease width">◀</button>
          <button style={s.sizeBtn} onClick={() => changeWidth(1)} title="Increase width">▶</button>
          <span style={{ ...s.lastUpdated, margin: "0 4px", opacity: 0.4 }}>│</span>
          <button style={s.sizeBtn} onClick={() => changeFontSize(-1)} title="Decrease font size">−</button>
          <span style={{ ...s.lastUpdated, minWidth: 18, textAlign: "center" }}>{fs}</span>
          <button style={s.sizeBtn} onClick={() => changeFontSize(1)} title="Increase font size">+</button>
          <span style={{ ...s.lastUpdated, marginLeft: 4 }}>
            {data.fetchedAt ? timeAgo(data.fetchedAt) : "—"}
          </span>
        </div>
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
  );
};
