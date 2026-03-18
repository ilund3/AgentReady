# AgentReady

AgentReady is a platform for managing deployments, infrastructure, and **MCP (Model Context Protocol) tooling**—including an integrated **MCP Inspector** in the dashboard.

## MCP Inspector

The dashboard includes **MCP Inspector** at **Dashboard → MCP Inspector**. The Inspector UI lives in `apps/dokploy/inspector/` and is rendered in the same app (no iframe).

- **Dev:** from the repo root, run `pnpm run dokploy:dev` and open **MCP Inspector** from the sidebar.

## Development

```bash
pnpm install
pnpm run dokploy:dev
```

- **API docs:** generate OpenAPI with `pnpm run generate:openapi` (outputs `openapi.json`).
- **Docs:** [docs.agentready.com](https://docs.agentready.com/docs/core)

## License

See the repository license file. Portions of this codebase derive from upstream open-source projects used under their respective licenses.
