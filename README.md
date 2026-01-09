# claude-oc-proxy

Transparent proxy that adds/strips `oc_` tool name (configurable) prefixes for Claude API requests. Works with [CLI Proxy API](https://github.com/router-for-me/CLIProxyAPI).


## Quick Start

**Basically all you need to do:**
```bash
npx @xeiroh/claude-oc-proxy --setup
```

This will:
1. Install CLI Proxy API (if missing)
2. Run Claude OAuth login
3. Start the proxy stack
4. Print your endpoint (which you can plug into opencode.json)



## Installation

No installation required. Run directly with npx or bunx:

```bash
# Using npx (Node.js)
npx @xeiroh/claude-oc-proxy --help

# Using bunx (Bun) - recommended
bunx @xeiroh/claude-oc-proxy --help

# Using pnpm
pnpm dlx @xeiroh/claude-oc-proxy --help
```

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
# Terminal 1
cli-proxy-api

# Terminal 2
npx @xeiroh/claude-oc-proxy
# or
bunx @xeiroh/claude-oc-proxy
```

Endpoint: `http://localhost:8318/v1`

## Usage

```bash
npx @xeiroh/claude-oc-proxy [OPTIONS]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `8318` | Listen port |
| `-u, --upstream <url>` | `http://localhost:8317` | Upstream API URL |
| `-s, --setup` | | Interactive setup wizard |
| `-h, --help` | | Show help |

### Examples

```bash
# Start with defaults
npx @xeiroh/claude-oc-proxy

# Custom port
npx @xeiroh/claude-oc-proxy -p 9000

# Custom upstream
npx @xeiroh/claude-oc-proxy -u http://myapi:8000

# Both
npx @xeiroh/claude-oc-proxy -p 9000 -u http://myapi:8000

# Interactive setup
npx @xeiroh/claude-oc-proxy --setup
```

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

## Credits

Tool prefixing workaround discovered in [anomalyco/opencode-anthropic-auth#10](https://github.com/anomalyco/opencode-anthropic-auth/pull/10).

## License

MIT
