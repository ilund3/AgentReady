#!/usr/bin/env node
// Runs tsc with a larger call stack to handle large source files with
// emoji/non-ASCII characters that exhaust the default ~1MB Node.js stack.
// --stack-size cannot be set via NODE_OPTIONS, so we spawn a child process.
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Resolve tsc: try relative path first (pnpm isolated), then require.resolve
const relPath = path.resolve(__dirname, "..", "node_modules", "typescript", "bin", "tsc");
let tscBin;
if (fs.existsSync(relPath)) {
  tscBin = relPath;
} else {
  try {
    tscBin = require.resolve("typescript/bin/tsc");
  } catch (e) {
    console.error("[tsc-large-stack] Cannot find typescript/bin/tsc:", e.message);
    console.error("[tsc-large-stack] Tried:", relPath);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
console.log("[tsc-large-stack] Running:", process.execPath, "--stack-size=8192", tscBin, ...args);

const result = spawnSync(
  process.execPath,
  ["--stack-size=8192", tscBin, ...args],
  { stdio: "inherit", env: process.env }
);

if (result.error) {
  console.error("[tsc-large-stack] spawn error:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
