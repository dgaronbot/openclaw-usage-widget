#!/bin/bash
# Token Monitor — data fetcher for Übersicht widget
# Fetches Claude Code usage + OpenClaw gateway usage, outputs JSON

CACHE_FILE="/tmp/token-monitor-cache.json"

now_epoch=$(date +%s)

# --- Panel 1: Claude Code Subscription Usage ---
claude_data='null'
claude_error=""

creds=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
if [ -n "$creds" ]; then
    token=$(echo "$creds" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['claudeAiOauth']['accessToken'])" 2>/dev/null)
    if [ -n "$token" ]; then
        raw=$(curl -s --max-time 8 \
            -H "Authorization: Bearer $token" \
            -H "anthropic-beta: oauth-2025-04-20" \
            "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)
        if echo "$raw" | python3 -c "import json,sys; json.loads(sys.stdin.read())" 2>/dev/null; then
            claude_data="$raw"
        else
            claude_error="API returned invalid JSON"
        fi
    else
        claude_error="Could not extract OAuth token"
    fi
else
    claude_error="No Claude Code credentials in Keychain"
fi

# --- Panels 2 & 3: OpenClaw Gateway Usage ---
openclaw_today='null'
openclaw_7d='null'
openclaw_all='null'
openclaw_error=""

oc_token=""
oc_config="$HOME/.openclaw/openclaw.json"
if [ -f "$oc_config" ]; then
    oc_token=$(python3 -c "import json; print(json.load(open('$oc_config'))['gateway']['auth']['token'])" 2>/dev/null)
fi

fetch_openclaw() {
    local range="$1"
    local result
    if [ -n "$oc_token" ]; then
        result=$(curl -s --max-time 8 \
            -H "Authorization: Bearer $oc_token" \
            "http://localhost:18789/v1/usage?range=$range" 2>/dev/null)
    else
        result=$(curl -s --max-time 8 \
            "http://localhost:18789/v1/usage?range=$range" 2>/dev/null)
    fi
    # Validate JSON
    if echo "$result" | python3 -c "import json,sys; json.loads(sys.stdin.read())" 2>/dev/null; then
        echo "$result"
    else
        echo "null"
    fi
}

openclaw_today=$(fetch_openclaw "today")
openclaw_7d=$(fetch_openclaw "7d")
openclaw_all=$(fetch_openclaw "all")

if [ "$openclaw_today" = "null" ] && [ "$openclaw_7d" = "null" ]; then
    openclaw_error="OpenClaw gateway unreachable"
fi

# --- Assemble output via env vars (safe against special chars in JSON) ---
export _TM_CLAUDE="$claude_data"
export _TM_OC_TODAY="$openclaw_today"
export _TM_OC_7D="$openclaw_7d"
export _TM_OC_ALL="$openclaw_all"
export _TM_CLAUDE_ERR="$claude_error"
export _TM_OC_ERR="$openclaw_error"
export _TM_EPOCH="$now_epoch"

output=$(python3 << 'PYEOF'
import json, sys, os

def safe_parse(s):
    try:
        return json.loads(s) if s and s != "null" else None
    except:
        return None

claude_data = os.environ.get("_TM_CLAUDE", "null")
oc_today = os.environ.get("_TM_OC_TODAY", "null")
oc_7d = os.environ.get("_TM_OC_7D", "null")
oc_all = os.environ.get("_TM_OC_ALL", "null")
claude_err = os.environ.get("_TM_CLAUDE_ERR", "") or None
oc_err = os.environ.get("_TM_OC_ERR", "") or None
fetched = int(os.environ.get("_TM_EPOCH", "0"))

result = {
    "claude": safe_parse(claude_data),
    "claudeError": claude_err,
    "openclaw": {
        "today": safe_parse(oc_today),
        "7d": safe_parse(oc_7d),
        "all": safe_parse(oc_all),
    },
    "openclawError": oc_err,
    "fetchedAt": fetched,
}
print(json.dumps(result))
PYEOF
)

if [ -n "$output" ] && [ "$output" != "null" ]; then
    echo "$output" > "$CACHE_FILE"
    echo "$output"
else
    # Fallback to cache
    if [ -f "$CACHE_FILE" ]; then
        cat "$CACHE_FILE"
    else
        echo '{"claude":null,"claudeError":"Fetch failed","openclaw":{"today":null,"7d":null,"all":null},"openclawError":"Fetch failed","fetchedAt":0}'
    fi
fi
