#!/usr/bin/env node
// Runs tsc with a larger call stack to handle large source files with
// emoji/non-ASCII characters that exhaust the default ~1MB Node.js stack.
// --stack-size cannot be set via NODE_OPTIONS, so we spawn a child process.
const { spawnSync } = require("child_process");

const tscBin = require.resolve("typescript/bin/tsc");
const args = process.argv.slice(2);

const result = spawnSync(
  process.execPath,
  ["--stack-size=8192", tscBin, ...args],
  { stdio: "inherit", env: process.env }
);

process.exit(result.status ?? 1);
