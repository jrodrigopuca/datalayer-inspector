#!/usr/bin/env node
/**
 * Smoke-test server for Strata.
 *
 * Serves tests/fixtures/pages over HTTP (the extension needs an http(s)
 * origin; file:// would require an extra permission) and manages a
 * background instance so you can start it, test in Chrome, and stop it.
 *
 *   pnpm smoke          start in the background and open the smoke page
 *   pnpm smoke:stop     stop the background server
 *   pnpm smoke:status   is it running? which URL?
 *
 * Options: --port <n> (default 8765), --no-open, --fg (run in foreground)
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PAGES_DIR = join(ROOT, "tests", "fixtures", "pages");
const PID_FILE = join(ROOT, ".smoke.pid");
const DEFAULT_PAGE = "strata-smoke.html";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("--")) ?? "start";
const port = Number(readOption("--port") ?? process.env.SMOKE_PORT ?? 8765);
const shouldOpen = !args.includes("--no-open");
const foreground = args.includes("--fg");

function readOption(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function baseUrl() {
  return `http://127.0.0.1:${port}`;
}

// ---------------------------------------------------------------- server

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(
        new URL(req.url ?? "/", baseUrl()).pathname
      );
      const relative = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      const target = join(PAGES_DIR, relative);

      if (!target.startsWith(PAGES_DIR)) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      const info = await stat(target).catch(() => null);

      if (info?.isDirectory()) {
        const files = (await readdir(target)).filter((f) =>
          f.endsWith(".html")
        );
        const items = files
          .map((f) => `<li><a href="${f}">${f}</a></li>`)
          .join("");
        res
          .writeHead(200, { "Content-Type": MIME[".html"] })
          .end(`<h1>Strata smoke pages</h1><ul>${items}</ul>`);
        return;
      }

      if (!info?.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": MIME[extname(target)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(readFileSync(target));
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  console.log(`[smoke] serving ${PAGES_DIR} at ${baseUrl()}`);

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// ---------------------------------------------------------------- control

function readPid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  return Number.isInteger(pid) ? pid : null;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl()}/${DEFAULT_PAGE}`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

function openInBrowser(url) {
  const opener =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).unref();
}

async function start() {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(
      `[smoke] already running (pid ${existing}) at ${baseUrl()}/${DEFAULT_PAGE}`
    );
    if (shouldOpen) openInBrowser(`${baseUrl()}/${DEFAULT_PAGE}`);
    return;
  }

  if (foreground) {
    await serve();
    return;
  }

  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "serve", "--port", String(port)],
    {
      detached: true,
      stdio: "ignore",
    }
  );
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));

  if (!(await waitForServer())) {
    console.error(
      `[smoke] server did not answer on ${baseUrl()}; is the port busy? Try --port <n>.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[smoke] running (pid ${child.pid})`);
  console.log(`[smoke] page: ${baseUrl()}/${DEFAULT_PAGE}`);
  console.log("[smoke] stop with: pnpm smoke:stop");
  if (shouldOpen) openInBrowser(`${baseUrl()}/${DEFAULT_PAGE}`);
}

function stop() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
    console.log("[smoke] not running");
    return;
  }
  process.kill(pid, "SIGTERM");
  unlinkSync(PID_FILE);
  console.log(`[smoke] stopped (pid ${pid})`);
}

function status() {
  const pid = readPid();
  if (pid && isAlive(pid)) {
    console.log(`[smoke] running (pid ${pid}) at ${baseUrl()}/${DEFAULT_PAGE}`);
  } else {
    console.log("[smoke] not running");
    process.exitCode = 1;
  }
}

switch (command) {
  case "serve":
    await serve();
    break;
  case "start":
    await start();
    break;
  case "stop":
    stop();
    break;
  case "status":
    status();
    break;
  default:
    console.error(
      `[smoke] unknown command "${command}". Use start | stop | status.`
    );
    process.exitCode = 1;
}
