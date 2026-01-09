# claude-oc-proxy

Transparent proxy that adds/strips `oc_` tool name prefixes for Claude API requests. Works with [CLI Proxy API](https://github.com/router-for-me/CLIProxyAPI).

## Quick Start

```bash
bunx @xeiroh/claude-oc-proxy --setup
```

This will:
1. Install CLI Proxy API (if missing)
2. Run Claude OAuth login
3. Start the proxy stack
4. Print your endpoint

## Manual Setup

### 1. Install CLI Proxy API

**macOS:**
```bash
brew install cliproxyapi
```

**Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash
```

### 2. Authenticate

```bash
cli-proxy-api -claude-login
```

### 3. Start

```bash
cli-proxy-api                      # Terminal 1
bunx @xeiroh/claude-oc-proxy       # Terminal 2
```

Endpoint: `http://localhost:8318/v1`

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port` | `8318` | Listen port |
| `-u, --upstream` | `http://localhost:8317` | Upstream API URL |

Example: `bunx @xeiroh/claude-oc-proxy -p 9000 -u http://myapi:8000`

## OpenCode Setup

Add to `~/.config/opencode/opencode.json`:

```json
{
  "provider": {
    "local": {
      "npm": "@ai-sdk/anthropic",
      "name": "Local",
      "options": {
        "baseURL": "http://localhost:8318/v1",
        "apiKey": "not-needed"
      },
      "models": {
        "claude-opus-4-5-20251101": {
          "name": "Claude Opus 4.5",
          "limit": { "context": 200000, "output": 64000 },
          "options": {
            "thinking": { "type": "enabled", "budgetTokens": 32000 }
          }
        },
        "claude-sonnet-4-5-20250929": {
          "name": "Claude Sonnet 4.5",
          "limit": { "context": 200000, "output": 16000 }
        }
      }
    }
  }
}
```

Use: `local/claude-opus-4-5-20251101`

## How It Works

```
Client → claude-oc-proxy (:8318) → CLI Proxy API (:8317) → Claude API
              ↓                           ↓
         adds oc_ prefix            handles OAuth
         strips on response
```

## License

MIT
