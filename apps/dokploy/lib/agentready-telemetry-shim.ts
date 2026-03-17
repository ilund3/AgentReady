/**
 * Keep in sync with buildTelemetryShimJs in packages/server/.../rebundle-zip.ts
 * (client-safe: Skill Inspector zip download in the browser.)
 */
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
