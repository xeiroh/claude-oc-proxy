#!/usr/bin/env bun
import { spawn, spawnSync } from "child_process";
import { createInterface } from "readline";

const TOOL_PREFIX = "oc_";
const DEFAULT_UPSTREAM = "http://localhost:8317";
const DEFAULT_PORT = 8318;

const args = process.argv.slice(2);

function getArg(flags: string[]): string | undefined {
  for (const flag of flags) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
  }
  return undefined;
}

const port = parseInt(getArg(["-p", "--port"]) || String(DEFAULT_PORT), 10);
const upstream = getArg(["-u", "--upstream"]) || DEFAULT_UPSTREAM;

if (args.includes("--help") || args.includes("-h")) {
  showHelp();
} else if (args.includes("--setup") || args.includes("-s")) {
  await runSetup();
} else {
  startProxy(port, upstream);
}

function showHelp() {
  console.log(`
claude-oc-proxy - Tool name prefixing proxy for Claude API

USAGE:
  bunx @xeiroh/claude-oc-proxy [OPTIONS]

OPTIONS:
  -p, --port <port>          Port to listen on (default: 8318)
  -u, --upstream <url>       Upstream API URL (default: http://localhost:8317)
  -s, --setup                Interactive setup (install cli-proxy-api, OAuth, start stack)
  -h, --help                 Show this help message

EXAMPLES:
  bunx @xeiroh/claude-oc-proxy                          # Start with defaults
  bunx @xeiroh/claude-oc-proxy -p 9000                  # Custom port
  bunx @xeiroh/claude-oc-proxy -u http://myapi:8000     # Custom upstream
  bunx @xeiroh/claude-oc-proxy --setup                  # Interactive first-time setup

MANUAL SETUP:
  1. Install cli-proxy-api:
     macOS:  brew install cliproxyapi
     Linux:  curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash

  2. Authenticate: cli-proxy-api -claude-login

  3. Start stack:
     Terminal 1: cli-proxy-api
     Terminal 2: bunx @xeiroh/claude-oc-proxy

  Endpoint: http://localhost:8318/v1
`);
  process.exit(0);
}

async function runSetup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((res) => rl.question(q, res));

  console.log("\n=== claude-oc-proxy setup ===\n");

  let binary = getCliProxyApiBinary();
  if (!binary) {
    console.log("cli-proxy-api not found.");
    const install = await ask("Install cli-proxy-api? (y/n): ");
    if (install.toLowerCase() === "y") {
      await installCliProxyApi();
      binary = getCliProxyApiBinary();
      if (!binary) {
        console.error("Installation succeeded but binary not found in PATH.");
        console.error("Try restarting your terminal or add it to PATH manually.");
        rl.close();
        process.exit(1);
      }
    } else {
      console.log("Cannot proceed without cli-proxy-api. Exiting.");
      rl.close();
      process.exit(1);
    }
  } else {
    console.log(`cli-proxy-api found: ${binary}`);
  }

  const doAuth = await ask("\nRun Claude OAuth login? (y/n): ");
  if (doAuth.toLowerCase() === "y") {
    console.log("\nStarting Claude OAuth flow...");
    console.log("Complete the login in your browser.\n");
    const authResult = spawnSync(binary, ["-claude-login"], {
      stdio: "inherit",
    });
    if (authResult.status !== 0) {
      console.log("Auth failed or was cancelled.");
      rl.close();
      process.exit(1);
    }
    console.log("\nAuth complete!");
  }

  const startNow = await ask("\nStart proxy stack now? (y/n): ");
  if (startNow.toLowerCase() !== "y") {
    console.log("\nSetup complete. Run manually:");
    console.log(`  Terminal 1: ${binary}`);
    console.log("  Terminal 2: bunx @xeiroh/claude-oc-proxy");
    rl.close();
    process.exit(0);
  }

  rl.close();

  console.log("\nStarting cli-proxy-api...");
  const cliProxy = spawn(binary, [], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  cliProxy.stdout?.on("data", (d) => process.stdout.write(`[cli-proxy-api] ${d}`));
  cliProxy.stderr?.on("data", (d) => process.stderr.write(`[cli-proxy-api] ${d}`));

  await new Promise((r) => setTimeout(r, 2000));

  if (cliProxy.exitCode !== null) {
    console.error("cli-proxy-api failed to start. Check your config.yaml");
    process.exit(1);
  }

  console.log("Starting claude-oc-proxy...\n");
  startProxy(port, upstream);

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    cliProxy.kill();
    process.exit(0);
  });
}

function getCliProxyApiBinary(): string | null {
  const names = ["cli-proxy-api", "cliproxyapi"];
  for (const name of names) {
    const result = spawnSync("which", [name]);
    if (result.status === 0) return name;
  }
  return null;
}

async function installCliProxyApi() {
  const platform = process.platform;

  if (platform === "darwin") {
    console.log("Installing via Homebrew...");
    const result = spawnSync("brew", ["install", "cliproxyapi"], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      console.error("Homebrew install failed. Install manually.");
      process.exit(1);
    }
  } else if (platform === "linux") {
    console.log("Installing via official installer...");
    const result = spawnSync(
      "bash",
      [
        "-c",
        "curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash",
      ],
      { stdio: "inherit" }
    );
    if (result.status !== 0) {
      console.error("Install failed. Install manually from:");
      console.error("https://github.com/router-for-me/CLIProxyAPI/releases");
      process.exit(1);
    }
  } else {
    console.error(`Unsupported platform: ${platform}`);
    console.error("Download manually: https://github.com/router-for-me/CLIProxyAPI/releases");
    process.exit(1);
  }

  console.log("Installation complete!");
}

function startProxy(PORT: number = DEFAULT_PORT, UPSTREAM: string = DEFAULT_UPSTREAM) {

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const upstreamUrl = `${UPSTREAM}${url.pathname}${url.search}`;

      let body = await req.text();
      let isAnthropic = false;

      if (body) {
        try {
          const parsed = JSON.parse(body);

          isAnthropic =
            parsed.model?.startsWith("anthropic/") ||
            parsed.model?.startsWith("claude-");

          if (parsed.model?.startsWith("anthropic/")) {
            parsed.model = parsed.model.slice("anthropic/".length);
          }

          if (isAnthropic && parsed.tools && Array.isArray(parsed.tools)) {
            parsed.tools = parsed.tools.map((tool: any) => ({
              ...tool,
              name: tool.name ? `${TOOL_PREFIX}${tool.name}` : tool.name,
            }));
          }

          body = JSON.stringify(parsed);
        } catch {
          // Parse error - pass through
        }
      }

      const headers = new Headers(req.headers);
      headers.delete("content-length");

      const response = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: body || undefined,
      });

      if (isAnthropic && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              return;
            }

            let text = decoder.decode(value, { stream: true });
            text = text.replace(/"name"\s*:\s*"oc_([^"]+)"/g, '"name": "$1"');
            controller.enqueue(encoder.encode(text));
          },
        });

        return new Response(stream, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      return response;
    },
  });

  console.log(`claude-oc-proxy listening on port ${PORT}`);
  console.log(`Proxying to: ${UPSTREAM}`);
  console.log(`\nEndpoint: http://localhost:${PORT}/v1`);
}
