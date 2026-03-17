import AdmZip from "adm-zip";

/** OpenClaw telemetry shim source (inlined so Next/Turbopack never resolves a sibling .js path). */
export function buildTelemetryShimJs(pluginId: string): string {
	const safeId = pluginId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	return `
"use strict";
const fs = require("fs");
const path = require("path");
const HOOK_PREFIX = "${safeId}-analytics.";
const DEBUG = process.env.AGENTREADY_ANALYTICS_DEBUG === "1" || process.env.AGENTREADY_ANALYTICS_DEBUG === "true";

function loadConfig() {
  try {
    const p = path.join(__dirname, "agentready-analytics.json");
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw);
    if (typeof j.trackingId !== "string" || typeof j.endpointBaseUrl !== "string") return null;
    return { trackingId: j.trackingId, endpointBaseUrl: j.endpointBaseUrl.replace(/\\/$/, "") };
  } catch {
    return null;
  }
}

function trimKey(s, max) {
  if (typeof s !== "string") return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

function buildPayload(hookName, ev, ctx) {
  ev = ev || {};
  ctx = ctx || {};
  var p = { t: Date.now(), hook: hookName };
  try {
    if (hookName === "message_received" || hookName === "message_sending" || hookName === "message_sent") {
      p.channel = ctx.channelId || undefined;
      p.accountId = trimKey(ctx.accountId, 64);
    } else if (hookName === "agent_end") {
      p.channel = ctx.channelId;
      p.sessionKey = trimKey(ctx.sessionKey, 80);
      p.trigger = ctx.trigger;
      p.agentSuccess = ev.success;
      p.durationMs = typeof ev.durationMs === "number" ? ev.durationMs : undefined;
      p.turnMessageCount = Array.isArray(ev.messages) ? ev.messages.length : undefined;
    } else if (hookName === "before_tool_call" || hookName === "after_tool_call") {
      p.toolName = ev.toolName;
      p.sessionKey = trimKey(ctx.sessionKey, 80);
      p.runId = trimKey(ctx.runId, 64);
      if (hookName === "after_tool_call") {
        p.durationMs = typeof ev.durationMs === "number" ? ev.durationMs : undefined;
        p.toolOk = !ev.error;
      }
    } else if (hookName === "session_start" || hookName === "session_end") {
      p.sessionKey = trimKey(ev.sessionKey, 80);
      p.sessionId = trimKey(ev.sessionId, 64);
      if (hookName === "session_end") {
        p.sessionMessageCount = ev.messageCount;
        p.sessionDurationMs = ev.durationMs;
      }
    } else if (hookName === "before_compaction") {
      p.preCompactionMessages = ev.messageCount;
      p.compactingCount = ev.compactingCount;
    } else if (hookName === "after_compaction") {
      p.compactedCount = ev.compactedCount;
      p.postCompactionMessages = ev.messageCount;
    } else if (hookName === "before_prompt_build") {
      p.channel = ctx.channelId;
      p.sessionKey = trimKey(ctx.sessionKey, 80);
      p.trigger = ctx.trigger;
    } else if (hookName === "gateway_start" || hookName === "gateway_stop") {
      p.gatewayEvent = hookName;
    }
  } catch (e) {
    if (DEBUG) console.warn("[agentready-analytics] payload build error", hookName, e && e.message);
  }
  return p;
}

function send(config, eventType, payload) {
  var url = config.endpointBaseUrl + "/" + encodeURIComponent(config.trackingId) + "/events";
  var body = JSON.stringify({ events: [{ eventType: eventType, payload: payload || {} }] });
  if (DEBUG) {
    console.warn("[agentready-analytics] POST", eventType, url, JSON.stringify(payload));
  }
  if (typeof fetch !== "function") {
    if (DEBUG) console.warn("[agentready-analytics] fetch not available; install Node 18+ or set global fetch");
    return;
  }
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body })
    .then(function (res) {
      if (DEBUG) console.warn("[agentready-analytics] response", eventType, res.status, res.statusText);
      if (!res.ok && !DEBUG) console.warn("[agentready-analytics] ingest failed", res.status, eventType);
    })
    .catch(function (err) {
      console.warn("[agentready-analytics] ingest error", eventType, err && err.message);
    });
}

var HOOKS = [
  "message_received",
  "message_sending",
  "message_sent",
  "agent_end",
  "before_tool_call",
  "after_tool_call",
  "session_start",
  "session_end",
  "before_compaction",
  "after_compaction",
  "before_prompt_build",
  "gateway_start",
  "gateway_stop",
];

function install(api) {
  if (typeof api.registerHook !== "function") return;
  var config = loadConfig();
  if (!config) {
    if (DEBUG) console.warn("[agentready-analytics] missing or invalid agentready-analytics.json");
    return;
  }
  for (var i = 0; i < HOOKS.length; i++) {
    (function (hookName) {
      try {
        api.registerHook(
          hookName,
          function (ev, ctx) {
            send(config, hookName, buildPayload(hookName, ev, ctx));
          },
          { optional: true, name: HOOK_PREFIX + hookName },
        );
      } catch (e) {
        if (DEBUG) console.warn("[agentready-analytics] registerHook failed", hookName, e && e.message);
      }
    })(HOOKS[i]);
  }
  if (DEBUG) console.warn("[agentready-analytics] registered", HOOKS.length, "hooks for tracking", config.trackingId.slice(0, 8) + "…");
}

module.exports = { install };
`.trim();
}

const CONFIG_FILENAME = "agentready-analytics.json";
const TELEMETRY_FILENAME = "agentready-telemetry.js";
const ENTRY_INDEX = "index.js";
const ENTRY_ORIGINAL = "index.original.js";
const PACKAGE_JSON = "package.json";
const OPENCLAW_MANIFEST = "openclaw.plugin.json";

/** Single top-level dir name used when the zip is flat or has multiple roots. OpenClaw's resolvePackedRootDir accepts this. */
const WRAPPER_DIR = "package";

/**
 * Wrapper for index.js: runs telemetry install then forwards to original plugin.
 */
const WRAPPER_JS = `
"use strict";
var agentready = require("./agentready-telemetry.js");
var original = require("./index.original.js");
var def = typeof original === "function" ? { register: original } : (original && typeof original === "object" ? original : {});
var register = def.register || def.activate;
if (typeof register !== "function") {
  module.exports = original;
} else {
  module.exports = Object.assign({}, def, {
    register: function(api) {
      agentready.install(api);
      return register(api);
    }
  });
}
`.trim();

/**
 * Reads openclaw.plugin.json from the zip and returns plugin id if present.
 */
export function parsePluginIdFromZip(zipBuffer: Buffer): string | null {
	try {
		const zip = new AdmZip(zipBuffer);
		const entries = zip.getEntries();
		const manifestEntry = entries.find(
			(e) =>
				e.entryName === "openclaw.plugin.json" ||
				e.entryName.endsWith("/openclaw.plugin.json"),
		);
		if (!manifestEntry?.getData) return null;
		const data = manifestEntry.getData();
		if (!data) return null;
		const json = JSON.parse(data.toString("utf8")) as { id?: string };
		return typeof json.id === "string" ? json.id : null;
	} catch {
		return null;
	}
}

/**
 * Builds a minimal package.json so "openclaw plugins install" accepts the zip.
 * OpenClaw requires package.json with openclaw.extensions when installing from a zip.
 */
function buildPackageJson(zip: AdmZip, rootPrefix: string): Buffer {
	let name = "agentready-tracked-plugin";
	let version = "1.0.0";
	const manifestEntry = zip.getEntry(rootPrefix + OPENCLAW_MANIFEST);
	if (manifestEntry?.getData) {
		try {
			const raw = manifestEntry.getData().toString("utf8");
			const m = JSON.parse(raw) as { id?: string; name?: string; version?: string };
			if (typeof m.id === "string" && m.id.trim()) name = m.id.trim();
			else if (typeof m.name === "string" && m.name.trim()) name = m.name.trim();
			if (typeof m.version === "string" && m.version.trim()) version = m.version.trim();
		} catch {
			// keep defaults
		}
	}
	const pkg = {
		name,
		version,
		openclaw: { extensions: ["./index.js"] as string[] },
	};
	return Buffer.from(JSON.stringify(pkg, null, 2), "utf8");
}

/**
 * Injects AgentReady analytics into the plugin zip so any plugin (no extra setup)
 * reports usage when run in OpenClaw. Adds:
 * - agentready-analytics.json (trackingId, endpointBaseUrl)
 * - agentready-telemetry.js (shim that registers hooks and POSTs events)
 * - If index.js exists: renames to index.original.js and adds wrapper index.js; then adds package.json if missing (so "openclaw plugins install" accepts the zip and finds ./index.js).
 */
export function rebundlePluginZipWithTracking(
	zipBuffer: Buffer,
	trackingId: string,
	endpointBaseUrl: string,
): Buffer {
	let zip = new AdmZip(zipBuffer);
	const entries = zip.getEntries().filter((e) => !e.entryName.startsWith("__MACOSX"));
	const topLevelDirs = new Set(
		entries.map((e) => {
			const parts = e.entryName.split("/").filter(Boolean);
			return parts[0] ?? "";
		}),
	);
	topLevelDirs.delete("");

	// OpenClaw expects exactly one top-level directory in the zip (resolvePackedRootDir).
	// If the zip is flat or has multiple roots, wrap everything under WRAPPER_DIR so
	// install succeeds and discovery finds ./index.js inside the package root.
	let rootPrefix: string;
	if (topLevelDirs.size === 1) {
		rootPrefix = `${[...topLevelDirs][0]}/`;
	} else {
		const newZip = new AdmZip();
		for (const e of entries) {
			const name = `${WRAPPER_DIR}/${e.entryName}`;
			if (e.isDirectory) {
				newZip.addFile(name.endsWith("/") ? name : name + "/", Buffer.alloc(0));
			} else if (e.getData) {
				newZip.addFile(name, e.getData());
			}
		}
		zip = newZip;
		rootPrefix = `${WRAPPER_DIR}/`;
	}

	const config = {
		trackingId,
		endpointBaseUrl: endpointBaseUrl.replace(/\/$/, ""),
	};
	const pluginIdForHooks = parsePluginIdFromZip(zipBuffer) ?? "plugin";
	zip.addFile(rootPrefix + CONFIG_FILENAME, Buffer.from(JSON.stringify(config, null, 2)));
	zip.addFile(rootPrefix + TELEMETRY_FILENAME, Buffer.from(buildTelemetryShimJs(pluginIdForHooks), "utf8"));

	const indexEntry = zip.getEntry(rootPrefix + ENTRY_INDEX);
	if (indexEntry && !indexEntry.isDirectory && indexEntry.getData) {
		const originalBuffer = indexEntry.getData();
		zip.deleteFile(rootPrefix + ENTRY_INDEX);
		zip.addFile(rootPrefix + ENTRY_ORIGINAL, originalBuffer);
		zip.addFile(rootPrefix + ENTRY_INDEX, Buffer.from(WRAPPER_JS, "utf8"));
		// Only add package.json when we have index.js so OpenClaw finds the extension
		const hasPackageJson = zip.getEntry(rootPrefix + PACKAGE_JSON);
		if (!hasPackageJson) {
			zip.addFile(rootPrefix + PACKAGE_JSON, buildPackageJson(zip, rootPrefix));
		}
	}

	return zip.toBuffer();
}
