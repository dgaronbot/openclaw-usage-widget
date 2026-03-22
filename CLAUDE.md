# Token Monitor — CLAUDE.md

## What this is
Übersicht widget for macOS that shows Claude Code subscription limits, OpenClaw API spend, and local MLX token usage.

## Widget location
~/Library/Application Support/Übersicht/widgets/token-monitor/

## Files
- `index.jsx` — main widget UI (Übersicht JSX format)
- `fetch-data.sh` — data fetcher (parses OpenClaw session logs + Anthropic OAuth API)
- Prefs: `~/.token-monitor-prefs.json`
- Cache: `/tmp/token-monitor-cache.json`

## Data sources
- **Claude Code limits:** Anthropic OAuth API via token in macOS Keychain
- **API spend:** `~/.openclaw/agents/main/sessions/*.jsonl` (parsed by fetch-data.sh)
- **MLX usage:** Same session logs, filtered by local model names

## Testing
- Open Übersicht on macOS — widget auto-reloads when files change
- Run `bash fetch-data.sh` to test data fetching directly
- Check output JSON structure matches what index.jsx expects

## Deployment
- Widget files must be in `~/Library/Application Support/Übersicht/widgets/token-monitor/`
- Übersicht must be running
- No build step required — edit and Übersicht reloads automatically

## Commit style
- Bisect commits (one logical change per commit)
- Bump version in README when shipping

## Related
- Original CostWidget (reference): https://github.com/dgaronbot/CostWidget
- TokenEater (forked base): https://github.com/AThevon/TokenEater
