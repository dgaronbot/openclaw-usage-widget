<h1 align="center">Token Monitor</h1>

<p align="center">
  <strong>An <a href="http://tracesof.net/uebersicht/">Übersicht</a> widget for macOS that monitors Claude Code usage, OpenClaw API spend, and local MLX inference — all in one floating desktop panel.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-14%2B-111?logo=apple&logoColor=white" alt="macOS 14+">
  <img src="https://img.shields.io/badge/%C3%9Cbersicht-widget-007AFF" alt="Übersicht widget">
  <img src="https://img.shields.io/badge/Claude-Pro%20%2F%20Max%20%2F%20Team-D97706" alt="Claude Pro / Max / Team">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

---

## What it shows

### Panel 1 — Claude Code Subscription
- 5-hour and 7-day usage buckets with percentage bars
- Color-coded: green (<50%), yellow (50–80%), red (>80%)
- Reset countdown for each bucket
- Extra usage spend tracking

### Panel 2 — OpenClaw API Spend
- Total cost with per-model breakdown (Anthropic, OpenRouter, etc.)
- Input/output token counts per model
- Toggle between Today / 7 Days / All Time

### Panel 3 — Local MLX Usage
- Local model token counts (free, no cost)
- Same time range toggle as API panel

## Install

### Prerequisites
- [Übersicht](http://tracesof.net/uebersicht/) installed
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) authenticated (`claude` → `/login`) with a **Pro, Max, or Team plan**
- (Optional) [OpenClaw](https://github.com/AThevon/openclaw) gateway running locally for panels 2 & 3

### Setup

```bash
# Clone into your Übersicht widgets directory
cp -r widget/ ~/Library/Application\ Support/Übersicht/widgets/token-monitor/
chmod +x ~/Library/Application\ Support/Übersicht/widgets/token-monitor/fetch-data.sh
```

Or symlink for development:
```bash
ln -s "$(pwd)/widget" ~/Library/Application\ Support/Übersicht/widgets/token-monitor
```

Übersicht will auto-detect the widget and render it on your desktop.

## Configuration

Edit `index.jsx` to customize:

| Setting | Location | Default |
|---------|----------|---------|
| Position | `className` | `top: 20px; right: 20px` |
| Width | `className` | `340px` |
| Font size | `className` | `12px` |
| Refresh interval | `refreshFrequency` | `60000` (60s) |

## How it works

```
fetch-data.sh
├── Reads Claude Code OAuth token from macOS Keychain
│   └── GET https://api.anthropic.com/api/oauth/usage
├── Reads OpenClaw auth token from ~/.openclaw/openclaw.json
│   └── GET http://localhost:18789/v1/usage?range={today|7d|all}
└── Outputs combined JSON → index.jsx renders it

Offline: falls back to /tmp/token-monitor-cache.json
```

## Uninstall

```bash
rm -rf ~/Library/Application\ Support/Übersicht/widgets/token-monitor/
```

## License

MIT
