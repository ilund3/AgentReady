"use client";

import { ChevronDown, ChevronRight, Monitor, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** Static logos under public/client-logos/ */
export const CLIENT_LOGO_PATHS = {
	chatgpt: "/client-logos/chatgpt.png",
	claude: "/client-logos/claude.png",
	mistral: "/client-logos/mistral.png",
	cursor: "/client-logos/cursor.png",
	vscode: "/client-logos/vscode.png",
	codex: "/client-logos/codex.png",
	geminiCli: "/client-logos/gemini-cli.png",
	goose: "/client-logos/goose.png",
	openclaw: "/client-logos/openclaw.avif",
	openfang: "/client-logos/openfang.webp",
	nanobot: "/client-logos/nanobot.png",
	zeroclaw: "/client-logos/zeroclaw.png",
	anythingllm: "/client-logos/anythingllm.svg",
} as const;

const L = CLIENT_LOGO_PATHS;

function CodeBlock({ children }: { children: string }) {
	return (
		<pre className="mt-2 rounded-md border bg-muted/50 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
			{children}
		</pre>
	);
}

function InlineCode({ children }: { children: React.ReactNode }) {
	return (
		<code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
			{children}
		</code>
	);
}

function ClientCollapsible({
	title,
	logoSrc,
	defaultOpen = false,
	children,
}: {
	title: string;
	logoSrc?: string;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-lg border bg-card"
		>
			<CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 transition-colors rounded-lg">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{logoSrc ? (
						// eslint-disable-next-line @next/next/no-img-element -- mixed formats (avif/webp/svg/png) from static public assets
						<img
							src={logoSrc}
							alt=""
							width={32}
							height={32}
							className="h-8 w-8 shrink-0 object-contain"
						/>
					) : null}
					<span className="truncate">{title}</span>
				</div>
				{open ? (
					<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
				)}
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="border-t px-4 py-3 text-sm text-muted-foreground space-y-3 leading-relaxed">
					{children}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function SkillClientsPanel({
	mcpUrl,
	displayName,
	cliId,
	skillDescription,
}: {
	mcpUrl: string;
	displayName: string;
	cliId: string;
	skillDescription: string;
}) {
	const cursorMcpJson = useMemo(
		() =>
			JSON.stringify(
				{
					mcpServers: {
						[displayName]: {
							type: "http",
							url: mcpUrl,
						},
					},
				},
				null,
				2,
			),
		[displayName, mcpUrl],
	);

	const vsCodeMcpJson = useMemo(
		() =>
			JSON.stringify(
				{
					servers: {
						[displayName]: {
							type: "http",
							url: mcpUrl,
						},
					},
				},
				null,
				2,
			),
		[displayName, mcpUrl],
	);

	const gooseYaml = useMemo(
		() =>
			`extensions:
  ${cliId}:
    enabled: true
    type: streamable_http
    name: ${displayName}
    description: ${skillDescription.replace(/"/g, '\\"').slice(0, 200)}${skillDescription.length > 200 ? "…" : ""}
    uri: ${mcpUrl}
    timeout: 300`,
		[cliId, displayName, mcpUrl, skillDescription],
	);

	return (
		<div className="space-y-6 max-w-3xl">
			<p className="text-sm text-muted-foreground">
				Connect your MCP skill to popular clients. Set your{" "}
				<strong>MCP server URL</strong> in Setup → metadata{" "}
				<InlineCode>mcp-server</InlineCode> to customize the URLs below.
				Instructions use your current skill name and URL.
			</p>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base flex items-center gap-2">
						<Monitor className="h-4 w-4" />
						LLMs
					</CardTitle>
					<p className="text-sm text-muted-foreground font-normal">
						Chat apps, editors, and assistants that support remote MCP over
						HTTP.
					</p>
				</CardHeader>
				<CardContent className="space-y-2">
					<ClientCollapsible title="ChatGPT Apps" logoSrc={L.chatgpt}>
						<ol className="list-decimal pl-4 space-y-2">
							<li>
								Navigate to <strong>Settings → Connectors</strong>
							</li>
							<li>Scroll down and click on Advanced Settings</li>
							<li>Enable Developer mode</li>
							<li>
								Go back to the <strong>Settings → Connectors</strong> page, and
								click <strong>Create</strong> in the Browser Connectors section
							</li>
							<li>
								Add a custom connector with the MCP Server URL:{" "}
								<InlineCode>{mcpUrl}</InlineCode>
							</li>
							<li>Click on Create to add the MCP server as a Connector</li>
							<li>
								To use your newly created connector in the chat, click{" "}
								<strong>+</strong> then <strong>More</strong> and select it.
							</li>
						</ol>
					</ClientCollapsible>

					<ClientCollapsible title="Claude Connectors" logoSrc={L.claude}>
						<ol className="list-decimal pl-4 space-y-2">
							<li>
								Navigate to <strong>Settings → Connectors</strong>
							</li>
							<li>Locate the Connectors section</li>
							<li>
								Click <strong>Add custom connector</strong> at the bottom of the
								section
							</li>
							<li>
								Add your connector&apos;s remote MCP server URL:{" "}
								<InlineCode>{mcpUrl}</InlineCode>
							</li>
							<li>Finish configuring your connector and click Add</li>
							<li>
								To enable connectors, use the <strong>Search and tools</strong>{" "}
								button on the lower left of the chat.
							</li>
						</ol>
					</ClientCollapsible>

					<ClientCollapsible title="Mistral" logoSrc={L.mistral}>
						<ol className="list-decimal pl-4 space-y-2">
							<li>
								Open the side panel and expand{" "}
								<strong>Intelligence → Connectors</strong>
							</li>
							<li>
								Click <strong>+ Add Connector</strong> on the right side of the
								page
							</li>
							<li>
								In the MCP Connectors directory, click the{" "}
								<strong>Custom MCP Connector</strong> tab
							</li>
							<li>
								Enter a Connector Name and the following Connector Server URL:{" "}
								<InlineCode>{mcpUrl}</InlineCode>
							</li>
							<li>Finish configuring your connector and click Create</li>
							<li>
								To use the connector, click the <strong>Tools</strong> button
								below the chat input and enable it in the Connectors section.
							</li>
						</ol>
					</ClientCollapsible>

					<ClientCollapsible title="Cursor" logoSrc={L.cursor}>
						<div className="space-y-4">
							<div>
								<p className="font-medium text-foreground mb-2">
									Option 1 — One-click install
								</p>
								<p className="mb-2">
									In Cursor, open the MCP panel and add this server via the install flow.
								</p>
							</div>
							<div>
								<p className="font-medium text-foreground mb-2">
									Option 2 — Manual setup with mcp.json
								</p>
								<p>
									Cursor stores MCP servers configuration through an{" "}
									<InlineCode>mcp.json</InlineCode> file.
								</p>
								<ol className="list-decimal pl-4 space-y-2 mt-2">
									<li>Open (or create) your mcp.json file.</li>
									<li>
										Add this MCP server right under{" "}
										<InlineCode>mcpServers</InlineCode>, like so:
									</li>
								</ol>
								<CodeBlock>{cursorMcpJson}</CodeBlock>
								<p className="mt-2">
									Once saved, Cursor Agent automatically uses this MCP
									server&apos;s tools when relevant.
								</p>
							</div>
						</div>
					</ClientCollapsible>

					<ClientCollapsible title="VS Code" logoSrc={L.vscode}>
						<div className="space-y-4">
							<div>
								<p className="font-medium text-foreground mb-2">
									Option 1 — One-click install
								</p>
								<p className="mb-2">
									In VS Code, open the MCP install panel and add this server. You may need to
									enable the MCP server gallery in VS Code settings first.
								</p>
							</div>
							<div>
								<p className="font-medium text-foreground mb-2">
									Option 2 — Manual setup
								</p>
								<p>
									VS Code stores MCP servers configuration in{" "}
									<InlineCode>mcp.json</InlineCode>.
								</p>
								<ol className="list-decimal pl-4 space-y-2 mt-2">
									<li>
										Open (or create) your{" "}
										<InlineCode>.vscode/mcp.json</InlineCode> file.
									</li>
									<li>
										Add this MCP server under <InlineCode>servers</InlineCode>,
										like so:
									</li>
								</ol>
								<CodeBlock>{vsCodeMcpJson}</CodeBlock>
								<p className="mt-2">
									Once you have added the MCP server, you can use its tools in
									the Chat view (
									<kbd className="text-xs border rounded px-1">⌃⌘I</kbd>
									).
								</p>
							</div>
						</div>
					</ClientCollapsible>

					<ClientCollapsible title="Claude Code" logoSrc={L.claude}>
						<p>
							MCP servers added to Claude Code are stored in{" "}
							<InlineCode>~/.claude.json</InlineCode>.
						</p>
						<p className="mt-2">
							To install this MCP server, run the following command in your
							terminal:
						</p>
						<CodeBlock>{`claude mcp add --transport http ${cliId} "${mcpUrl}"`}</CodeBlock>
						<p className="mt-2">
							In the Claude Code terminal UI, use <InlineCode>/mcp</InlineCode>{" "}
							to view actively connected MCP servers. You should see your
							recently connected MCP server and can use it right away.
						</p>
					</ClientCollapsible>

					<ClientCollapsible title="Codex" logoSrc={L.codex}>
						<p>
							MCP configuration for Codex is stored in{" "}
							<InlineCode>~/.codex/config.toml</InlineCode> and is shared
							between the CLI and the IDE extension.
						</p>
						<p className="font-medium text-foreground mt-3">
							Option 1 — Configure via the Codex CLI
						</p>
						<p className="mt-1">Run the following command in your terminal:</p>
						<CodeBlock>{`codex mcp add ${cliId} --url "${mcpUrl}"`}</CodeBlock>
						<p className="font-medium text-foreground mt-3">
							Option 2 — Modify the Codex config file directly
						</p>
						<ol className="list-decimal pl-4 space-y-2 mt-2">
							<li>
								Open <InlineCode>~/.codex/config.toml</InlineCode>.
							</li>
							<li>Add the following snippet to your config.toml file:</li>
						</ol>
						<CodeBlock>{`[mcp_servers."${cliId}"]
url = "${mcpUrl}"`}</CodeBlock>
						<p className="mt-2">
							In the Codex terminal UI, use <InlineCode>/mcp</InlineCode> to
							view actively connected MCP servers.
						</p>
					</ClientCollapsible>

					<ClientCollapsible title="Gemini CLI" logoSrc={L.geminiCli}>
						<p className="font-medium text-foreground">
							Option 1 — Configure via the Gemini CLI
						</p>
						<p className="mt-1">Run the following command in your terminal:</p>
						<CodeBlock>{`gemini mcp add --transport http ${cliId} "${mcpUrl}"`}</CodeBlock>
						<p className="mt-2">
							Use <InlineCode>/mcp</InlineCode> in the Gemini CLI terminal to
							view your recently added MCP server status and discovered tools.
						</p>
						<p className="font-medium text-foreground mt-4">
							Option 2 — Configure via settings.json directly
						</p>
						<p>
							MCP servers used by Gemini CLI are configured in settings.json.
						</p>
						<ol className="list-decimal pl-4 space-y-2 mt-2">
							<li>
								Open <InlineCode>~/.gemini/settings.json</InlineCode> (user) or{" "}
								<InlineCode>.gemini/settings.json</InlineCode> (project).
							</li>
							<li>
								Add your server under <InlineCode>mcpServers</InlineCode>:
							</li>
						</ol>
						<CodeBlock>
							{JSON.stringify(
								{
									mcpServers: {
										[cliId]: {
											httpUrl: mcpUrl,
										},
									},
								},
								null,
								2,
							)}
						</CodeBlock>
						<p className="mt-2">
							Restart the Gemini CLI (or start a new session), then run{" "}
							<InlineCode>/mcp</InlineCode> to confirm it&apos;s connected.
						</p>
					</ClientCollapsible>

					<ClientCollapsible title="Goose" logoSrc={L.goose}>
						<div className="space-y-4">
							<div>
								<p className="font-medium text-foreground mb-2">
									Option 1 — One-click install
								</p>
								<p className="mb-2">
									If your environment supports it, open Goose Desktop and add
									this MCP server as a custom HTTP extension from the Extensions
									panel.
								</p>
							</div>
							<div>
								<p className="font-medium text-foreground mb-2">
									Option 2 — Edit config.yaml directly
								</p>
								<p>
									MCP servers used by Goose are configured in config.yaml.
								</p>
								<ol className="list-decimal pl-4 space-y-2 mt-2">
									<li>
										Open (or create){" "}
										<InlineCode>~/.config/goose/config.yaml</InlineCode>.
									</li>
									<li>
										Add this server under <InlineCode>extensions</InlineCode>,
										like so:
									</li>
								</ol>
								<CodeBlock>{gooseYaml}</CodeBlock>
								<p className="mt-2">
									Restart Goose (or start a new session), then check the
									Extensions panel to confirm it&apos;s connected.
								</p>
							</div>
						</div>
					</ClientCollapsible>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base flex items-center gap-2">
						<Terminal className="h-4 w-4" />
						CLI-based agents
					</CardTitle>
					<p className="text-sm text-muted-foreground font-normal">
						Terminal-first agents that often support MCP via config files or
						plugins.
					</p>
				</CardHeader>
				<CardContent className="space-y-2">
					<ClientCollapsible title="OpenClaw" logoSrc={L.openclaw}>
						<p>
							OpenClaw is an open-source agent platform with a plugin system.
							Skills ship as plugin ZIPs; MCP tools can be exposed via gateway
							and plugins. Install skills with{" "}
							<InlineCode>openclaw plugins install &lt;file.zip&gt;</InlineCode>{" "}
							and configure allowed plugins in your gateway config.
						</p>
					</ClientCollapsible>

					<ClientCollapsible title="OpenFang" logoSrc={L.openfang}>
						<p>
							OpenFang is a Rust-based agent operating system with MCP client
							and server support, autonomous &quot;Hands,&quot; and many channel
							adapters. See the docs for wiring external MCP servers (e.g. your
							HTTP URL).
						</p>
					</ClientCollapsible>

					<ClientCollapsible title="Nanobot" logoSrc={L.nanobot}>
						<p>
							HKUDS Nanobot is an ultra-lightweight personal AI assistant
							(OpenClaw-inspired) with CLI and multi-channel support. Configure
							MCP / tool settings so agents can call your server at{" "}
							<InlineCode>{mcpUrl}</InlineCode>.
						</p>
					</ClientCollapsible>

					<ClientCollapsible title="ZeroClaw" logoSrc={L.zeroclaw}>
						<p>
							ZeroClaw is a compact Rust agent runtime. Use its configuration
							to attach MCP HTTP servers like{" "}
							<InlineCode>{mcpUrl}</InlineCode> where supported.
						</p>
					</ClientCollapsible>

					<ClientCollapsible title="Anything LLM" logoSrc={L.anythingllm}>
						<p>
							Anything LLM is a full-stack private-chat UI that supports custom
							agents and tools. Use its agent or MCP integration settings to
							point at your HTTP MCP server URL:{" "}
							<InlineCode>{mcpUrl}</InlineCode>
						</p>
					</ClientCollapsible>
				</CardContent>
			</Card>
		</div>
	);
}
