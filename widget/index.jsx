// Token Monitor — Übersicht widget
// Shows Claude Code subscription usage, OpenClaw API spend, and local MLX usage

export const command = `bash "$HOME/Library/Application Support/Übersicht/widgets/token-monitor/fetch-data.sh"`;

export const refreshFrequency = 60000; // 60 seconds

export const className = `
  top: 20px;
  right: 20px;
  width: 340px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  font-size: 12px;
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
  return "$" + v.toFixed(2);
}

function formatTokens(n) {
  if (n == null || n === 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

// --- Styles ---

const styles = {
  container: {
    background: "rgba(30, 30, 30, 0.88)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "14px 16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    letterSpacing: "-0.2px",
  },
  lastUpdated: {
    fontSize: 10,
    color: "#666",
  },
  section: {
    marginBottom: 12,
  },
  sectionLast: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 10,
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
    fontSize: 11,
  },
  value: {
    fontWeight: 500,
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 10,
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
    fontSize: 11,
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
    fontSize: 10,
  },
  modelCost: {
    color: "#e0e0e0",
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    minWidth: 44,
    textAlign: "right",
  },
};

// --- Usage Bar Component ---

function UsageBar({ label, pct, resetsAt }) {
  const color = usageColor(pct);
  const remaining = Math.max(0, 100 - pct);
  return (
    <div>
      <div style={styles.row}>
        <span style={styles.label}>{label}</span>
        <span style={{ ...styles.value, color }}>
          {pct}% used · {remaining}% left
        </span>
      </div>
      <div style={styles.bar}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
      </div>
      {resetsAt && (
        <div style={{ ...styles.label, fontSize: 10, marginBottom: 2 }}>
          Resets {formatDate(resetsAt)}
        </div>
      )}
    </div>
  );
}

// --- Claude Panel ---

function ClaudePanel({ data, error }) {
  if (error && !data) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Claude Code</div>
        <div style={styles.errorText}>{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Claude Code</div>
        <div style={styles.errorText}>No data</div>
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
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Claude Code</div>
      {buckets.map((b, i) => (
        <UsageBar key={i} label={b.label} pct={b.utilization} resetsAt={b.resets_at} />
      ))}
      {extra && extra.is_enabled && (
        <div style={{ ...styles.row, marginTop: 4 }}>
          <span style={styles.label}>Extra usage</span>
          <span style={styles.value}>
            {formatCost(extra.used_credits)} / {formatCost(extra.monthly_limit)}
          </span>
        </div>
      )}
    </div>
  );
}

// --- OpenClaw API Panel ---

function OpenClawAPIPanel({ data, error, range, onRangeChange }) {
  const rangeData = data && data[range];
  const apiData = rangeData && rangeData.api;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>OpenClaw API Spend</div>
      <RangeTabs range={range} onRangeChange={onRangeChange} />
      {error && !apiData ? (
        <div style={styles.errorText}>{error}</div>
      ) : !apiData ? (
        <div style={styles.errorText}>No API usage data</div>
      ) : (
        <div>
          <div style={styles.row}>
            <span style={styles.label}>Total cost</span>
            <span style={{ ...styles.value, color: "#e0e0e0" }}>
              {formatCost(apiData.totalCost != null ? apiData.totalCost : apiData.total_cost)}
            </span>
          </div>
          {apiData.models && apiData.models.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {apiData.models.map((m, i) => (
                <div key={i} style={styles.modelRow}>
                  <span style={styles.modelName}>
                    {m.provider}/{m.model}
                  </span>
                  <span style={styles.modelTokens}>
                    {formatTokens(m.input_tokens || m.inputTokens)}↑ {formatTokens(m.output_tokens || m.outputTokens)}↓
                  </span>
                  <span style={styles.modelCost}>{formatCost(m.cost)}</span>
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

function LocalMLXPanel({ data, error, range, onRangeChange }) {
  const rangeData = data && data[range];
  const localData = rangeData && rangeData.local;

  return (
    <div style={styles.sectionLast}>
      <div style={styles.sectionTitle}>Local MLX</div>
      <RangeTabs range={range} onRangeChange={onRangeChange} />
      {error && !localData ? (
        <div style={styles.errorText}>{error}</div>
      ) : !localData || !localData.models || localData.models.length === 0 ? (
        <div style={styles.errorText}>No local model usage</div>
      ) : (
        <div>
          {localData.models.map((m, i) => (
            <div key={i} style={styles.modelRow}>
              <span style={styles.modelName}>{m.model}</span>
              <span style={styles.modelTokens}>
                {formatTokens(m.input_tokens || m.inputTokens)}↑ {formatTokens(m.output_tokens || m.outputTokens)}↓
              </span>
              <span style={{ ...styles.modelCost, color: "#28c840" }}>free</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Range Tabs ---

function RangeTabs({ range, onRangeChange }) {
  const ranges = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 Days" },
    { key: "all", label: "All Time" },
  ];
  return (
    <div style={styles.tabs}>
      {ranges.map((r) => (
        <div
          key={r.key}
          style={{ ...styles.tab, ...(range === r.key ? styles.tabActive : {}) }}
          onClick={() => onRangeChange(r.key)}
        >
          {r.label}
        </div>
      ))}
    </div>
  );
}

// --- Main Widget ---

export const initialState = {
  data: null,
  apiRange: "today",
  localRange: "today",
};

export const updateState = (event, prevState) => {
  if (event.type === "UB/COMMAND_RAN") {
    try {
      const data = JSON.parse(event.output);
      return { ...prevState, data };
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
  return prevState;
};

export const render = ({ data, apiRange, localRange }, dispatch) => {
  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>Token Monitor</span>
        </div>
        <div style={styles.errorText}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Token Monitor</span>
        <span style={styles.lastUpdated}>
          {data.fetchedAt ? timeAgo(data.fetchedAt) : "—"}
        </span>
      </div>

      <ClaudePanel data={data.claude} error={data.claudeError} />

      <div style={styles.divider} />

      <OpenClawAPIPanel
        data={data.openclaw}
        error={data.openclawError}
        range={apiRange}
        onRangeChange={(r) => dispatch({ type: "SET_API_RANGE", range: r })}
      />

      <div style={styles.divider} />

      <LocalMLXPanel
        data={data.openclaw}
        error={data.openclawError}
        range={localRange}
        onRangeChange={(r) => dispatch({ type: "SET_LOCAL_RANGE", range: r })}
      />
    </div>
  );
};
