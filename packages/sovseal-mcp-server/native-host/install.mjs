#!/usr/bin/env node
/**
 * install.mjs — Register the sovseal native-messaging host with Chrome (and
 * other Chromium-family browsers) so the browser extension can reach the
 * on-device memory engine.
 *
 * What it does:
 *   1. Resolves the built host entry (`dist/native-host.js`).
 *   2. Writes a launcher (`~/.sovseal/native-host/run.sh|run.cmd`) that execs
 *      the current Node against that entry — robust against missing +x bits
 *      and PATH surprises, and a stable place to bake in SOVSEAL_API_KEY.
 *   3. Writes `com.sovseal.host.json` into the NativeMessagingHosts dir of
 *      every installed Chromium-family browser, locked to the pinned
 *      extension id via `allowed_origins`.
 *
 * Usage:
 *   node native-host/install.mjs            # register
 *   node native-host/install.mjs --uninstall
 *   SOVSEAL_API_KEY=sov_live_... node native-host/install.mjs   # enable sync
 *
 * Re-runnable and idempotent.
 */

import { homedir, platform } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  chmodSync,
  rmSync,
} from "node:fs";

import { HOST_NAME, EXTENSION_ID } from "./constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const OS = platform();
const UNINSTALL = process.argv.includes("--uninstall");

const hostEntry = resolve(__dirname, "..", "dist", "native-host.js");
const launcherDir = join(HOME, ".sovseal", "native-host");
const isWindows = OS === "win32";
const launcherPath = join(launcherDir, isWindows ? "run.cmd" : "run.sh");

/** Per-OS NativeMessagingHosts directories for Chromium-family browsers. */
function targetDirs() {
  if (OS === "darwin") {
    const base = join(HOME, "Library", "Application Support");
    return [
      join(base, "Google", "Chrome"),
      join(base, "Google", "Chrome Beta"),
      join(base, "Google", "Chrome Canary"),
      join(base, "Chromium"),
      join(base, "BraveSoftware", "Brave-Browser"),
      join(base, "Microsoft Edge"),
      join(base, "Arc", "User Data"),
    ];
  }
  if (OS === "win32") {
    const base = process.env.LOCALAPPDATA ?? join(HOME, "AppData", "Local");
    return [
      join(base, "Google", "Chrome", "User Data"),
      join(base, "Chromium", "User Data"),
      join(base, "BraveSoftware", "Brave-Browser", "User Data"),
      join(base, "Microsoft", "Edge", "User Data"),
    ];
  }
  // linux + others
  const base = join(HOME, ".config");
  return [
    join(base, "google-chrome"),
    join(base, "google-chrome-beta"),
    join(base, "chromium"),
    join(base, "BraveSoftware", "Brave-Browser"),
    join(base, "microsoft-edge"),
  ];
}

function writeLauncher() {
  mkdirSync(launcherDir, { recursive: true });
  const node = process.execPath;
  const apiKey = process.env.SOVSEAL_API_KEY;
  if (isWindows) {
    const lines = ["@echo off"];
    if (apiKey) lines.push(`set "SOVSEAL_API_KEY=${apiKey}"`);
    lines.push(`"${node}" "${hostEntry}" %*`);
    writeFileSync(launcherPath, lines.join("\r\n") + "\r\n", "utf8");
  } else {
    const lines = ["#!/bin/sh"];
    if (apiKey) lines.push(`export SOVSEAL_API_KEY='${apiKey.replace(/'/g, "")}'`);
    lines.push(`exec "${node}" "${hostEntry}" "$@"`);
    writeFileSync(launcherPath, lines.join("\n") + "\n", "utf8");
    chmodSync(launcherPath, 0o755);
  }
}

function hostManifest() {
  return {
    name: HOST_NAME,
    description: "sovseal on-device memory bridge",
    path: launcherPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
  };
}

function install() {
  if (!existsSync(hostEntry)) {
    console.error(
      `[sovseal] build the host first: \`pnpm --filter @sovseal/mcp-server build\`\n` +
        `          (expected ${hostEntry})`,
    );
    process.exit(1);
  }

  writeLauncher();
  const manifest = JSON.stringify(hostManifest(), null, 2);
  const manifestName = `${HOST_NAME}.json`;

  let written = 0;
  for (const browserDir of targetDirs()) {
    if (!existsSync(browserDir)) continue; // browser not installed
    const nmDir = join(browserDir, "NativeMessagingHosts");
    mkdirSync(nmDir, { recursive: true });
    writeFileSync(join(nmDir, manifestName), manifest, "utf8");
    console.error(`[sovseal] registered host → ${join(nmDir, manifestName)}`);
    written += 1;
  }

  if (written === 0) {
    console.error(
      "[sovseal] no Chromium-family browser dirs found. Manifest contents:\n" +
        manifest,
    );
  }

  if (isWindows) {
    console.error(
      "\n[sovseal] Windows also needs a registry key. Run (cmd, as your user):\n" +
        `  reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}" /ve /t REG_SZ /d "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\NativeMessagingHosts\\${HOST_NAME}.json" /f`,
    );
  }

  console.error(
    `\n[sovseal] done. Extension id locked to ${EXTENSION_ID}.` +
      (process.env.SOVSEAL_API_KEY
        ? " Background sync ENABLED (SOVSEAL_API_KEY baked into launcher)."
        : " Local-only (set SOVSEAL_API_KEY before install to enable server-blind sync)."),
  );
}

function uninstall() {
  const manifestName = `${HOST_NAME}.json`;
  for (const browserDir of targetDirs()) {
    const file = join(browserDir, "NativeMessagingHosts", manifestName);
    if (existsSync(file)) {
      rmSync(file);
      console.error(`[sovseal] removed ${file}`);
    }
  }
  if (existsSync(launcherPath)) {
    rmSync(launcherPath);
    console.error(`[sovseal] removed ${launcherPath}`);
  }
  console.error("[sovseal] uninstalled native host.");
}

if (UNINSTALL) uninstall();
else install();
