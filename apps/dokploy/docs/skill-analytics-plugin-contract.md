# Skill Analytics — What we inject

When you register a plugin zip in the Skill Inspector **Analytics** tab, the platform rebundles it so **any** plugin works with tracking—no extra code in the plugin.

## Injected files

Inside the zip (in the same top-level folder as the rest of the plugin) we add:

1. **`agentready-analytics.json`** — config with `trackingId` and `endpointBaseUrl`.
2. **`agentready-telemetry.js`** — a small shim that reads that config and registers OpenClaw hooks (`message_received`, `agent_end`, `before_tool_call`, `after_tool_call`, `session_start`, `session_end`) and POSTs event counts to AgentReady (no PII).
3. **If the plugin has `index.js`:** we rename it to `index.original.js` and add a new `index.js` that runs the telemetry shim then the original plugin. So when OpenClaw loads the plugin, tracking is active automatically.

Plugins that use **`index.js`** as their main entry are fully auto-instrumented. Plugins that use only `index.ts` or `index.mjs` get the config and shim on disk but are not wrapped; they could optionally `require('./agentready-telemetry.js').install(api)` in their own code if desired.

## Event ingestion

Events are sent to:

```
POST {endpointBaseUrl}/{trackingId}/events
Content-Type: application/json
```

Body: `{ "events": [ { "eventType": string, "payload": object } ] }` (max 100 per request). No auth; `trackingId` identifies the registered skill. Events appear in the Skill Inspector **Analytics** tab for the user who registered the plugin.
