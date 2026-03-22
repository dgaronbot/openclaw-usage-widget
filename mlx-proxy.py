#!/usr/bin/env python3
"""MLX Token Logging Proxy — forwards requests to MLX server, logs usage stats."""

import http.server
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

MLX_PORT = 8080
PROXY_PORT = 8081
USAGE_LOG = os.path.expanduser("~/mlx-usage.jsonl")


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        self._proxy()

    def do_GET(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def do_OPTIONS(self):
        self._proxy()

    def _proxy(self):
        target = f"http://127.0.0.1:{MLX_PORT}{self.path}"
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Build forwarded request
        headers = {}
        for key, val in self.headers.items():
            if key.lower() not in ("host", "transfer-encoding"):
                headers[key] = val

        req = urllib.request.Request(target, data=body, headers=headers, method=self.command)

        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                resp_body = resp.read()
                status = resp.status
                resp_headers = dict(resp.getheaders())
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            status = e.code
            resp_headers = dict(e.headers.items())
        except Exception as e:
            self.send_error(502, f"Proxy error: {e}")
            return

        # Extract and log usage tokens from response
        self._log_usage(resp_body)

        # Return original response
        self.send_response(status)
        for key, val in resp_headers.items():
            if key.lower() not in ("transfer-encoding", "connection"):
                self.send_header(key, val)
        self.end_headers()
        self.wfile.write(resp_body)

    def _log_usage(self, resp_body):
        try:
            data = json.loads(resp_body)
            usage = data.get("usage")
            if not usage:
                return
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            total_tokens = usage.get("total_tokens", 0)
            if total_tokens == 0 and prompt_tokens == 0 and completion_tokens == 0:
                return
            entry = {
                "ts": datetime.now(timezone.utc).isoformat(),
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "model": data.get("model", "unknown"),
            }
            with open(USAGE_LOG, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    def log_message(self, format, *args):
        # Suppress default access logging
        pass


class ReusableHTTPServer(http.server.HTTPServer):
    allow_reuse_address = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PROXY_PORT
    server = ReusableHTTPServer(("127.0.0.1", port), ProxyHandler)
    print(f"MLX proxy listening on 127.0.0.1:{port} → 127.0.0.1:{MLX_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
