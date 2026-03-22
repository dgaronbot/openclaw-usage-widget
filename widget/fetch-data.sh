#!/bin/bash
# Token Monitor — data fetcher for Übersicht widget
# Reads Claude Code OAuth usage + parses OpenClaw session JSONL logs
# Outputs JSON with claude, openclaw (api + local), and fetchedAt

CACHE_FILE="/tmp/token-monitor-cache.json"
PREFS_FILE="$HOME/.token-monitor-prefs.json"
SESSIONS_DIR="$HOME/.openclaw/agents/main/sessions"

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

# --- Panels 2 & 3: Parse OpenClaw session JSONL files ---
export _TM_SESSIONS_DIR="$SESSIONS_DIR"

openclaw_json=$(python3 << 'PYEOF'
import json, glob, os
from datetime import datetime, timezone, timedelta

sessions_dir = os.environ.get("_TM_SESSIONS_DIR", "")

# Known OpenRouter model patterns
openrouter_patterns = ['kimi', 'moonshotai/', 'openrouter/', 'deepseek/', 'qwen/', 'mistralai/']
# Known local/MLX model patterns
mlx_patterns = ['mlx', 'local/', 'gguf', 'qwen3.5-mlx', 'llama-mlx']

def is_openrouter_model(model_name):
    model_lower = model_name.lower()
    return any(p in model_lower for p in openrouter_patterns)

def is_mlx_model(model_name):
    model_lower = model_name.lower()
    return any(p in model_lower for p in mlx_patterns)

def is_anthropic_model(model_name):
    ml = model_name.lower()
    return 'claude' in ml or ml.startswith('anthropic/')

now = datetime.now(timezone.utc)
today_str = now.strftime('%Y-%m-%d')
seven_days_ago = now - timedelta(days=7)

# Collect all message entries
entries = []
for f in glob.glob(sessions_dir + '/*.jsonl'):
    if '.deleted.' in f:
        continue
    try:
        with open(f) as fh:
            for line in fh:
                try:
                    d = json.loads(line.strip())
                    if d.get('type') != 'message':
                        continue
                    msg = d.get('message', {})
                    u = msg.get('usage')
                    if not u:
                        continue
                    model = d.get('model', msg.get('model', 'unknown'))
                    cost_obj = u.get('cost', {})
                    cost_total = cost_obj.get('total', 0) if isinstance(cost_obj, dict) else 0
                    ts_str = d.get('timestamp', '')
                    ts_date = ts_str[:10] if ts_str else ''
                    input_tokens = u.get('input', 0)
                    output_tokens = u.get('output', 0)
                    cache_read = u.get('cacheRead', 0)

                    entries.append({
                        'model': model,
                        'cost': cost_total,
                        'date': ts_date,
                        'timestamp': ts_str,
                        'input_tokens': input_tokens,
                        'output_tokens': output_tokens,
                        'cache_read': cache_read,
                    })
                except:
                    pass
    except:
        pass

def classify(model):
    if is_mlx_model(model):
        return 'local'
    elif is_openrouter_model(model):
        return 'api'  # openrouter = paid API
    elif is_anthropic_model(model):
        return 'api'  # anthropic = paid API
    else:
        return 'api'  # default to API

def build_range(entries, date_filter):
    """Build api + local data for a date range."""
    filtered = entries
    if date_filter == 'today':
        filtered = [e for e in entries if e['date'] == today_str]
    elif date_filter == '7d':
        filtered = [e for e in entries if e['timestamp'] and e['timestamp'] >= seven_days_ago.isoformat()[:10]]

    api_models = {}
    local_models = {}

    for e in filtered:
        kind = classify(e['model'])
        target = api_models if kind == 'api' else local_models
        model = e['model']
        if model not in target:
            target[model] = {'cost': 0, 'input_tokens': 0, 'output_tokens': 0, 'requests': 0}
        target[model]['cost'] += e['cost']
        target[model]['input_tokens'] += e['input_tokens']
        target[model]['output_tokens'] += e['output_tokens']
        target[model]['requests'] += 1

    def model_list(d, include_cost=True):
        result = []
        for model, v in sorted(d.items(), key=lambda x: -x[1]['cost']):
            # Determine provider for display
            ml = model.lower()
            if 'claude' in ml or ml.startswith('anthropic/'):
                provider = 'anthropic'
            elif is_openrouter_model(model):
                provider = 'openrouter'
            else:
                provider = 'local'
            display_model = model.replace('openrouter/', '').replace('anthropic/', '')
            entry = {
                'provider': provider,
                'model': display_model,
                'input_tokens': v['input_tokens'],
                'output_tokens': v['output_tokens'],
                'requests': v['requests'],
            }
            if include_cost:
                entry['cost'] = round(v['cost'], 4)
            result.append(entry)
        return result

    api_total = sum(v['cost'] for v in api_models.values())
    api_list = model_list(api_models, include_cost=True)
    local_list = model_list(local_models, include_cost=False)

    return {
        'api': {
            'totalCost': round(api_total, 4),
            'models': api_list,
        },
        'local': {
            'models': local_list,
        },
    }

result = {
    'today': build_range(entries, 'today'),
    '7d': build_range(entries, '7d'),
    'all': build_range(entries, 'all'),
}

print(json.dumps(result))
PYEOF
)

# --- Assemble output ---
export _TM_CLAUDE="$claude_data"
export _TM_CLAUDE_ERR="$claude_error"
export _TM_OC="$openclaw_json"
export _TM_EPOCH="$now_epoch"

output=$(python3 << 'PYEOF'
import json, os

def safe_parse(s):
    try:
        return json.loads(s) if s and s != "null" else None
    except:
        return None

claude_data = os.environ.get("_TM_CLAUDE", "null")
claude_err = os.environ.get("_TM_CLAUDE_ERR", "") or None
oc_data = os.environ.get("_TM_OC", "null")
fetched = int(os.environ.get("_TM_EPOCH", "0"))

oc_parsed = safe_parse(oc_data)
oc_err = None if oc_parsed else "No session data found"

result = {
    "claude": safe_parse(claude_data),
    "claudeError": claude_err,
    "openclaw": oc_parsed,
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
        echo '{"claude":null,"claudeError":"Fetch failed","openclaw":null,"openclawError":"Fetch failed","fetchedAt":0}'
    fi
fi
