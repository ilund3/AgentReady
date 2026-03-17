import AdmZip from "adm-zip";

const CONFIG_FILENAME = "agentready-analytics.json";
const TELEMETRY_FILENAME = "agentready-telemetry.js";
const ENTRY_INDEX = "index.js";
const ENTRY_ORIGINAL = "index.original.js";
const PACKAGE_JSON = "package.json";
const OPENCLAW_MANIFEST = "openclaw.plugin.json";

/** Single top-level dir name used when the zip is flat or has multiple roots. OpenClaw's resolvePackedRootDir accepts this. */
const WRAPPER_DIR = "package";

/**
 * Injected telemetry shim: reads agentready-analytics.json and registers
 * OpenClaw plugin hooks that POST events to the AgentReady endpoint.
 * No PII; fire-and-forget.
 */
const TELEMETRY_SHIM_JS = `
"use strict";
const fs = require("fs");
const path = require("path");

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

function send(config, eventType, payload) {
  const url = config.endpointBaseUrl + "/" + encodeURIComponent(config.trackingId) + "/events";
  const body = JSON.stringify({ events: [{ eventType, payload: payload || {} }] });
  if (typeof fetch === "function") {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(function() {});
  }
}

function install(api) {
  if (typeof api.registerHook !== "function") return;
  const config = loadConfig();
  if (!config) return;
  var hooks = ["message_received", "agent_end", "before_tool_call", "after_tool_call", "session_start", "session_end"];
  for (var i = 0; i < hooks.length; i++) {
    (function(hookName) {
      try {
        api.registerHook(hookName, function() { send(config, hookName, { t: Date.now() }); }, { optional: true });
      } catch (e) {}
    })(hooks[i]);
  }
}

module.exports = { install };
`.trim();

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
	zip.addFile(rootPrefix + CONFIG_FILENAME, Buffer.from(JSON.stringify(config, null, 2)));
	zip.addFile(rootPrefix + TELEMETRY_FILENAME, Buffer.from(TELEMETRY_SHIM_JS, "utf8"));

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
