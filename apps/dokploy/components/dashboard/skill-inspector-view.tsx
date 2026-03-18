"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
	BookOpen,
	Download,
	CheckCircle2,
	Circle,
	AlertCircle,
	FileCode,
	ListChecks,
	BarChart3,
	Users,
	FileArchive,
	Trash2,
	Sparkles,
	ChevronDown,
	ChevronRight,
	Crown,
} from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Dropzone } from "@/components/ui/dropzone";
import { api } from "@/utils/api";
import { buildTelemetryShimJs } from "@/lib/agentready-telemetry-shim";
import Link from "next/link";
import {
	SkillClientsPanel,
	CLIENT_LOGO_PATHS,
} from "@/components/dashboard/skill-clients-panel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

const KEBAB_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 1024;
const RESERVED_NAMES = ["claude", "anthropic"];

function buildPluginIndexJs(pluginId: string): string {
	return `"use strict";

/**
 * OpenClaw plugin entry + AgentReady analytics.
 * Wraps api.registerHook so the telemetry script's hook registrations
 * include a name (required by OpenClaw), then runs the telemetry install.
 */
const telemetry = require("./agentready-telemetry");

function register(api) {
  if (typeof api.registerHook !== "function") return;

  const wrappedApi = { ...api };
  wrappedApi.registerHook = function (events, handler, opts) {
    const eventName = Array.isArray(events) ? events[0] : events;
    const name = (opts && opts.name) || "${pluginId}-analytics." + (eventName || "hook");
    return api.registerHook(events, handler, { ...opts, name });
  };

  telemetry.install(wrappedApi);
}

module.exports = { register };
`;
}

function toKebab(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

function buildFrontmatter(state: SkillState): string {
	const lines: string[] = ["---", `name: ${state.name || "your-skill-name"}`, `description: ${state.description?.trim() || "What it does. Use when user asks to [specific phrases]."}`];
	if (state.license) lines.push(`license: ${state.license}`);
	if (state.compatibility?.trim()) lines.push(`compatibility: ${state.compatibility.trim()}`);
	if (state.metadataAuthor || state.metadataVersion || state.metadataMcpServer) {
		lines.push("metadata:");
		if (state.metadataAuthor) lines.push(`  author: ${state.metadataAuthor}`);
		if (state.metadataVersion) lines.push(`  version: ${state.metadataVersion}`);
		if (state.metadataMcpServer) lines.push(`  mcp-server: ${state.metadataMcpServer}`);
	}
	lines.push("---");
	return lines.join("\n");
}

function buildSkillMd(state: SkillState): string {
	return `${buildFrontmatter(state)}\n\n${state.body?.trim() || "# Your Skill Name\n\n## Instructions\n\n(Add steps, examples, and troubleshooting.)"}`;
}

interface SkillState {
	name: string;
	description: string;
	license: string;
	compatibility: string;
	metadataAuthor: string;
	metadataVersion: string;
	metadataMcpServer: string;
	body: string;
}

const INITIAL_STATE: SkillState = {
	name: "",
	description: "",
	license: "",
	compatibility: "",
	metadataAuthor: "",
	metadataVersion: "",
	metadataMcpServer: "",
	body: `# Your Skill Name

## Instructions

### Step 1: (First major step)
Clear explanation of what happens.

### Step 2: (Next step)
(Add more steps as needed.)

## Examples

**Example 1:** (common scenario)
- User says: "..."
- Actions: ...
- Result: ...

## Troubleshooting

**Error:** (common error message)
- **Cause:** Why it happens
- **Solution:** How to fix
`,
};

const CHECKLIST_ITEMS = [
	{ id: "name-kebab", label: "Folder & name in kebab-case", check: (s: SkillState) => !s.name || KEBAB_REGEX.test(s.name) },
	{ id: "skill-md", label: "SKILL.md referenced (exact spelling)", check: () => true },
	{ id: "frontmatter-delims", label: "YAML frontmatter has --- delimiters", check: (s: SkillState) => !!s.name && !!s.description },
	{ id: "desc-what-when", label: "Description includes WHAT and WHEN (trigger phrases)", check: (s: SkillState) => (s.description?.length ?? 0) > 30 },
	{ id: "no-xml", label: "No XML tags (< >) in frontmatter", check: (s: SkillState) => !/[<>]/.test([s.name, s.description, s.license, s.compatibility].filter(Boolean).join("")) },
	{ id: "desc-length", label: "Description under 1024 characters", check: (s: SkillState) => (s.description?.length ?? 0) <= MAX_DESCRIPTION_LENGTH },
	{ id: "instructions-clear", label: "Instructions are clear and actionable", check: (s: SkillState) => (s.body?.length ?? 0) > 50 },
] as const;

/** Setup → Clients target checklist (matches Clients tab). Crown right = MCP / Pro-gated. */
const SETUP_CLIENT_GROUPS = [
	{
		label: "LLMs",
		clients: [
			{ id: "chatgpt-apps", label: "ChatGPT Apps", proMcp: true, logo: CLIENT_LOGO_PATHS.chatgpt },
			{ id: "claude-connectors", label: "Claude Connectors", proMcp: true, logo: CLIENT_LOGO_PATHS.claude },
			{ id: "mistral", label: "Mistral", proMcp: true, logo: CLIENT_LOGO_PATHS.mistral },
			{ id: "cursor", label: "Cursor", proMcp: true, logo: CLIENT_LOGO_PATHS.cursor },
			{ id: "vscode", label: "VS Code", proMcp: true, logo: CLIENT_LOGO_PATHS.vscode },
			{ id: "claude-code", label: "Claude Code", proMcp: true, logo: CLIENT_LOGO_PATHS.claude },
			{ id: "codex", label: "Codex", proMcp: true, logo: CLIENT_LOGO_PATHS.codex },
			{ id: "gemini-cli", label: "Gemini CLI", proMcp: true, logo: CLIENT_LOGO_PATHS.geminiCli },
			{ id: "goose", label: "Goose", proMcp: true, logo: CLIENT_LOGO_PATHS.goose },
		],
	},
	{
		label: "CLI-based agents",
		clients: [
			{ id: "openclaw", label: "OpenClaw", proMcp: false, logo: CLIENT_LOGO_PATHS.openclaw },
			{ id: "openfang", label: "OpenFang", proMcp: false, logo: CLIENT_LOGO_PATHS.openfang },
			{ id: "nanobot", label: "Nanobot", proMcp: true, logo: CLIENT_LOGO_PATHS.nanobot },
			{ id: "zeroclaw", label: "ZeroClaw", proMcp: false, logo: CLIENT_LOGO_PATHS.zeroclaw },
			{ id: "anything-llm", label: "Anything LLM", proMcp: true, logo: CLIENT_LOGO_PATHS.anythingllm },
		],
	},
] as const;

function AnalyticsRegistrationRow({
	trackingId,
	name,
	pluginId,
	createdAt,
	onRemove,
	removePending,
}: {
	trackingId: string;
	name: string;
	pluginId: string | null;
	createdAt: Date | string | null;
	onRemove: () => void;
	removePending: boolean;
}) {
	const [detailsOpen, setDetailsOpen] = useState(false);
	const { data: summary, isLoading } = api.skillAnalytics.getSummary.useQuery(
		{ trackingId },
		{ enabled: !!trackingId },
	);
	const { data: recentData, isLoading: recentLoading } = api.skillAnalytics.recentEvents.useQuery(
		{ trackingId, limit: 50 },
		{ enabled: detailsOpen && !!trackingId },
	);
	return (
		<li className="flex flex-col gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
			<div className="flex items-center justify-between gap-2 min-w-0">
				<div className="flex items-center gap-2 min-w-0">
					<FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="truncate font-medium">{name}</span>
					{pluginId && (
						<Badge variant="secondary" className="text-xs shrink-0">
							{pluginId}
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2 shrink-0 flex-wrap">
					<Button variant="outline" size="sm" className="h-7 text-xs" asChild>
						<Link href={`/dashboard/skill-analytics/${encodeURIComponent(trackingId)}`}>
							<BarChart3 className="h-3.5 w-3.5 mr-1" />
							Dashboard
						</Link>
					</Button>
					<span className="text-xs text-muted-foreground font-mono">{trackingId}</span>
					{createdAt != null && (
						<time className="text-xs text-muted-foreground" dateTime={new Date(createdAt).toISOString()}>
							{new Date(createdAt).toLocaleString()}
						</time>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground hover:text-destructive"
						onClick={onRemove}
						disabled={removePending}
						aria-label="Remove"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
			{isLoading ? (
				<p className="text-xs text-muted-foreground">Loading analytics…</p>
			) : summary ? (
				<div className="space-y-2">
					<div className="flex flex-wrap gap-2 text-xs">
						<span className="text-muted-foreground">
							Total events: <strong>{summary.totalEvents}</strong>
						</span>
						{Object.entries(summary.byEventType).map(([type, count]) => (
							<Badge key={type} variant="outline">
								{type}: {count}
							</Badge>
						))}
					</div>
					<p className="text-[11px] text-muted-foreground leading-snug">
						Counts are OpenClaw hook fires (e.g. <code className="bg-muted px-0.5 rounded">message_received</code>,{" "}
						<code className="bg-muted px-0.5 rounded">agent_end</code>) — not “skill reads” per se.
					</p>
					<Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
						<CollapsibleTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
							>
								{detailsOpen ? (
									<ChevronDown className="h-3.5 w-3.5" />
								) : (
									<ChevronRight className="h-3.5 w-3.5" />
								)}
								Show last 50 events
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="pt-2 pb-1">
							{recentLoading ? (
								<p className="text-xs text-muted-foreground">Loading events…</p>
							) : !recentData?.events.length ? (
								<p className="text-xs text-muted-foreground max-w-xl">
									No events in the database for this registration. Use the trackable zip from this tab, install it in
									OpenClaw, restart the gateway, and send traffic through a channel (e.g. Telegram). If counts stay at
									0, check <code className="bg-muted px-0.5 rounded">agentready-analytics.json</code> points at this
									AgentReady URL (reachable from the machine running OpenClaw).
								</p>
							) : (
								<div className="max-h-72 overflow-auto rounded-md border bg-background">
									<table className="w-full text-left text-xs">
										<thead className="sticky top-0 bg-muted/80 border-b">
											<tr>
												<th className="p-2 font-medium">Time</th>
												<th className="p-2 font-medium">Type</th>
												<th className="p-2 font-medium">Payload</th>
											</tr>
										</thead>
										<tbody>
											{recentData.events.map((ev) => (
												<tr key={ev.id} className="border-b border-border/50 align-top">
													<td className="p-2 whitespace-nowrap text-muted-foreground font-mono">
														{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : "—"}
													</td>
													<td className="p-2 font-mono">{ev.eventType}</td>
													<td className="p-2 font-mono text-[10px] break-all max-w-[200px] sm:max-w-xs">
														{ev.payload != null
															? JSON.stringify(ev.payload)
															: "—"}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</CollapsibleContent>
					</Collapsible>
				</div>
			) : null}
		</li>
	);
}

export function SkillInspectorView() {
	const [state, setState] = useState<SkillState>(INITIAL_STATE);
	const [activeTab, setActiveTab] = useState("setup");
	const [createDescription, setCreateDescription] = useState("");
	const [expandedInstructionFiles, setExpandedInstructionFiles] = useState<Set<string>>(new Set(["SKILL.md"]));
	const [clientsOpen, setClientsOpen] = useState(false);
	const [clientTargets, setClientTargets] = useState<Record<string, boolean>>({});
	const [proUpsellOpen, setProUpsellOpen] = useState(false);
	const [pendingDownload, setPendingDownload] = useState<{
		trackingId: string;
		zipBase64: string;
		fileName: string;
	} | null>(null);

	const utils = api.useUtils();
	const { data: registrations = [], isLoading: listLoading } =
		api.skillAnalytics.list.useQuery(undefined, { enabled: activeTab === "analytics" });
	const registerMutation = api.skillAnalytics.register.useMutation({
		onSuccess: (_data) => {
			void utils.skillAnalytics.list.invalidate();
		},
	});
	const removeMutation = api.skillAnalytics.remove.useMutation({
		onSuccess: () => {
			void utils.skillAnalytics.list.invalidate();
		},
	});
	const createFromDescriptionMutation = api.skillCreator.createFromDescription.useMutation({
		onSuccess: (data) => {
			setState((prev) => ({
				...prev,
				name: data.name || prev.name,
				description: data.description || prev.description,
				body: data.body || prev.body,
				license: data.license ?? prev.license,
				compatibility: data.compatibility ?? prev.compatibility,
				metadataAuthor: data.metadataAuthor ?? prev.metadataAuthor,
				metadataVersion: data.metadataVersion ?? prev.metadataVersion,
				metadataMcpServer: data.metadataMcpServer ?? prev.metadataMcpServer,
			}));
			setCreateDescription("");
			toast.success("Skill draft generated. Review and edit below, then check Instructions and Validate.");
		},
		onError: (e) => {
			toast.error(e.message || "Failed to generate skill");
		},
	});

	const update = useCallback(<K extends keyof SkillState>(key: K, value: SkillState[K]) => {
		setState((prev) => ({ ...prev, [key]: value }));
	}, []);

	const suggestedName = useMemo(() => toKebab(state.name || "your-skill-name"), [state.name]);

	const clientsMcpUrl = useMemo(
		() => state.metadataMcpServer.trim() || "https://capitals.skybridge.tech",
		[state.metadataMcpServer],
	);
	const clientsDisplayName = useMemo(() => {
		const k = state.name?.trim();
		if (!k) return "Capitals of the World";
		return k
			.split("-")
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
	}, [state.name]);
	const clientsCliId = useMemo(() => {
		const k = state.name?.trim();
		if (!k) return "Capitals-of-the-World";
		return k
			.split("-")
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join("-");
	}, [state.name]);
	const clientsSkillDescription = useMemo(
		() => state.description?.trim() || "An example ChatGPT/MCP app allowing you to explore the capitals of the world.",
		[state.description],
	);

	const selectedClientCount = useMemo(
		() => Object.values(clientTargets).filter(Boolean).length,
		[clientTargets],
	);

	const onClientCheck = useCallback((id: string, proMcp: boolean, checked: boolean) => {
		if (checked && proMcp) {
			setProUpsellOpen(true);
			return;
		}
		setClientTargets((prev) => ({ ...prev, [id]: checked }));
	}, []);

	const validation = useMemo(() => {
		return CHECKLIST_ITEMS.map((item) => ({
			...item,
			ok: item.check(state),
		}));
	}, [state]);

	const fullSkillMd = useMemo(() => buildSkillMd(state), [state]);

	const handleDownload = useCallback(async () => {
		const zip = new JSZip();
		const folder = zip.folder(suggestedName);
		if (!folder) {
			toast.error("Failed to create zip");
			return;
		}
		// OpenClaw plugin layout: one top-level dir, manifest, index.js, package.json (name = id), skills in skills/<id>/
		folder.file(`skills/${suggestedName}/SKILL.md`, fullSkillMd);
		folder.file(
			"openclaw.plugin.json",
			JSON.stringify(
				{
					id: suggestedName,
					name: state.name?.trim() || suggestedName,
					version: "1.0.0",
					description: state.description?.trim() || "Skill created with Skill Inspector.",
					configSchema: {},
					skills: [`./skills/${suggestedName}`],
				},
				null,
				2,
			),
		);
		folder.file("index.js", buildPluginIndexJs(suggestedName));
		folder.file(
			"package.json",
			JSON.stringify(
				{
					name: suggestedName,
					version: "1.0.0",
					openclaw: { extensions: ["./index.js"] },
				},
				null,
				2,
			),
		);
		folder.file(
			"agentready-analytics.json",
			JSON.stringify({ trackingId: "", endpointBaseUrl: "" }, null, 2),
		);
		folder.file("agentready-telemetry.js", buildTelemetryShimJs(suggestedName));
		folder.file("scripts/.gitkeep", "");
		folder.file("references/.gitkeep", "");
		folder.file("assets/.gitkeep", "");
		const blob = await zip.generateAsync({ type: "blob" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${suggestedName}.zip`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("ZIP downloaded");
	}, [fullSkillMd, suggestedName, state.name, state.description]);

	const handleAnalyticsZip = useCallback(
		async (files: FileList | null) => {
			const file = files?.[0];
			if (!file || !file.name.toLowerCase().endsWith(".zip")) {
				if (files?.length) toast.error("Please drop a .zip file");
				return;
			}
			const name = file.name.replace(/\.zip$/i, "") || file.name;
			let base64: string;
			try {
				const buf = await file.arrayBuffer();
				const bytes = new Uint8Array(buf);
				let binary = "";
				for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
				base64 = btoa(binary);
			} catch {
				toast.error("Failed to read file");
				return;
			}
			try {
				const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
				const result = await registerMutation.mutateAsync({
					zipBase64: base64,
					name,
					baseUrl: baseUrl || undefined,
				});
				setPendingDownload({
					trackingId: result.trackingId,
					zipBase64: result.trackableZipBase64,
					fileName: file.name.replace(/\.zip$/i, "") + "-trackable.zip",
				});
				toast.success(`Registered. Download the trackable zip below to distribute.`);
			} catch (e) {
				const msg = e instanceof Error ? e.message : "Registration failed";
				toast.error(msg);
			}
		},
		[registerMutation],
	);

	const downloadTrackableZip = useCallback(() => {
		if (!pendingDownload) return;
		const bin = Uint8Array.from(atob(pendingDownload.zipBase64), (c) => c.charCodeAt(0));
		const blob = new Blob([bin], { type: "application/zip" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = pendingDownload.fileName;
		a.click();
		URL.revokeObjectURL(url);
		setPendingDownload(null);
		toast.success("Trackable zip downloaded");
	}, [pendingDownload]);

	const removeAnalyticsZip = useCallback(
		(trackingId: string) => {
			removeMutation.mutate(
				{ trackingId },
				{
					onSuccess: () => toast.success("Removed from list"),
					onError: (e) => toast.error(e.message),
				},
			);
		},
		[removeMutation],
	);

	const allValid = validation.every((v) => v.ok);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="border-b bg-muted/30 px-4 py-3 flex items-center gap-2 shrink-0">
				<BookOpen className="h-5 w-5 text-muted-foreground" />
				<h1 className="font-semibold text-lg">Skill Inspector</h1>
				<Badge variant="secondary" className="ml-2">
					Claude Skills
				</Badge>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<div className="px-4 pt-3 shrink-0">
					<TabsList className="grid w-full max-w-5xl grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 h-auto min-h-10">
						<TabsTrigger value="setup">Setup</TabsTrigger>
						<TabsTrigger value="instructions">Instructions</TabsTrigger>
						<TabsTrigger value="validate" className="text-xs sm:text-sm px-2">
							Validate &amp; Export
						</TabsTrigger>
						<TabsTrigger value="analytics">Analytics</TabsTrigger>
						<TabsTrigger value="clients" className="gap-1">
							<Users className="h-3.5 w-3.5 hidden sm:inline" />
							Clients
						</TabsTrigger>
					</TabsList>
				</div>

				<div className="flex-1 overflow-auto p-4">
					<TabsContent value="setup" className="mt-0 h-full space-y-4">
						<Card className="max-w-5xl">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Clients</CardTitle>
								<p className="text-sm text-muted-foreground font-normal">
									Select where you plan to ship this skill.{" "}
									<span className="inline-flex items-center gap-0.5">
										<Crown className="h-3 w-3 text-amber-500 shrink-0" aria-hidden />
										<span>needs MCP hosting (AgentReady Pro).</span>
									</span>
								</p>
							</CardHeader>
							<CardContent>
								<Popover open={clientsOpen} onOpenChange={setClientsOpen}>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="outline"
											className="w-full max-w-md justify-between font-normal"
											aria-expanded={clientsOpen}
										>
											<span>Clients</span>
											<span className="flex items-center gap-2 text-muted-foreground">
												{selectedClientCount > 0 ? (
													<Badge variant="secondary" className="font-normal">
														{selectedClientCount} selected
													</Badge>
												) : null}
												<ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
											</span>
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
										<div className="max-h-[min(70vh,24rem)] overflow-y-auto p-2 space-y-3">
											{SETUP_CLIENT_GROUPS.map((group) => (
												<div key={group.label}>
													<p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
														{group.label}
													</p>
													<ul className="space-y-0.5">
														{group.clients.map((c) => (
															<li key={c.id}>
																<label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
																	<Checkbox
																		className="shrink-0"
																		checked={!!clientTargets[c.id]}
																		onCheckedChange={(v) =>
																			onClientCheck(c.id, c.proMcp, v === true)
																		}
																	/>
																	{/* eslint-disable-next-line @next/next/no-img-element -- public client logos (mixed formats) */}
																	<img
																		src={c.logo}
																		alt=""
																		width={32}
																		height={32}
																		className="h-8 w-8 shrink-0 object-contain"
																	/>
																	<span className="min-w-0 flex-1 leading-tight pr-1">{c.label}</span>
																	{c.proMcp ? (
																		<Crown
																			className="h-3.5 w-3.5 shrink-0 text-amber-500"
																			aria-label="Requires MCP server"
																		/>
																	) : (
																		<span className="h-3.5 w-3.5 shrink-0" aria-hidden />
																	)}
																</label>
															</li>
														))}
													</ul>
												</div>
											))}
										</div>
									</PopoverContent>
								</Popover>
							</CardContent>
						</Card>

						<Dialog open={proUpsellOpen} onOpenChange={setProUpsellOpen}>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle className="flex items-center gap-2">
										<Crown className="h-5 w-5 text-amber-500" />
										AgentReady Pro
									</DialogTitle>
									<DialogDescription className="text-base text-foreground pt-2">
										Try AgentReady Pro free for thirty days, then $200/M queries.
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button type="button" onClick={() => setProUpsellOpen(false)}>
										Got it
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>

						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<Sparkles className="h-4 w-4 text-primary" />
									Create skill from description
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									Describe the skill you want in plain language. We&apos;ll generate a draft (name, description, and instructions) using the skill-creator workflow.
								</p>
							</CardHeader>
							<CardContent className="space-y-3">
								<Textarea
									placeholder="e.g. A skill that helps me write conventional commit messages, or a skill for rotating PDF pages, or a skill that formats our internal status reports..."
									value={createDescription}
									onChange={(e) => setCreateDescription(e.target.value)}
									rows={3}
									className="resize-none"
									disabled={createFromDescriptionMutation.isPending}
								/>
								<Button
									type="button"
									onClick={() => {
										const trimmed = createDescription.trim();
										if (!trimmed) {
											toast.error("Enter a description first");
											return;
										}
										createFromDescriptionMutation.mutate({ description: trimmed });
									}}
									disabled={createFromDescriptionMutation.isPending}
								>
									{createFromDescriptionMutation.isPending ? "Generating…" : "Generate skill"}
								</Button>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Skill basics</CardTitle>
								<p className="text-sm text-muted-foreground">
									Required frontmatter and naming (from The Complete Guide to Building Skills for Claude).
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="skill-name">Name (kebab-case, required)</Label>
									<Input
										id="skill-name"
										placeholder="e.g. my-project-workflow"
										value={state.name}
										onChange={(e) => update("name", toKebab(e.target.value))}
									/>
									{state.name && !KEBAB_REGEX.test(state.name) && (
										<p className="text-xs text-amber-600 flex items-center gap-1">
											<AlertCircle className="h-3 w-3" />
											Use only lowercase letters, numbers, and hyphens. Suggested: {suggestedName}
										</p>
									)}
									{state.name && RESERVED_NAMES.some((r) => state.name.toLowerCase().includes(r)) && (
										<p className="text-xs text-destructive">Name cannot contain &quot;claude&quot; or &quot;anthropic&quot;</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="skill-desc">Description (required)</Label>
									<Textarea
										id="skill-desc"
										placeholder="What it does. Use when user asks to [specific phrases]."
										value={state.description}
										onChange={(e) => update("description", e.target.value)}
										rows={4}
										className="resize-none"
									/>
									<p className="text-xs text-muted-foreground">
										Include both what the skill does and when to use it (trigger phrases). No XML tags. Max {MAX_DESCRIPTION_LENGTH} chars.
									</p>
									{state.description.length > MAX_DESCRIPTION_LENGTH && (
										<p className="text-xs text-destructive">{state.description.length} / {MAX_DESCRIPTION_LENGTH}</p>
									)}
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="license">License (optional)</Label>
										<Input id="license" placeholder="e.g. MIT, Apache-2.0" value={state.license} onChange={(e) => update("license", e.target.value)} />
									</div>
									<div className="space-y-2">
										<Label htmlFor="compatibility">Compatibility (optional)</Label>
										<Input id="compatibility" placeholder="e.g. Claude Code, API" value={state.compatibility} onChange={(e) => update("compatibility", e.target.value)} />
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-muted-foreground">Metadata (optional)</Label>
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
										<Input placeholder="author" value={state.metadataAuthor} onChange={(e) => update("metadataAuthor", e.target.value)} />
										<Input placeholder="version" value={state.metadataVersion} onChange={(e) => update("metadataVersion", e.target.value)} />
										<Input placeholder="mcp-server" value={state.metadataMcpServer} onChange={(e) => update("metadataMcpServer", e.target.value)} />
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="instructions" className="mt-0 h-full">
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<FileCode className="h-4 w-4" />
									Instructions
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									Files included in this skill. Click the arrow to expand and edit each file.
								</p>
							</CardHeader>
							<CardContent className="space-y-0">
								{[
									{ id: "SKILL.md", label: "SKILL.md", content: state.body, updateKey: "body" as const },
								].map((file) => {
									const isExpanded = expandedInstructionFiles.has(file.id);
									const toggle = () => {
										setExpandedInstructionFiles((prev) => {
											const next = new Set(prev);
											if (next.has(file.id)) next.delete(file.id);
											else next.add(file.id);
											return next;
										});
									};
									return (
										<div key={file.id} className="border-b last:border-b-0">
											<button
												type="button"
												onClick={toggle}
												className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
											>
												<span className="font-mono text-sm truncate">{file.label}</span>
												{isExpanded ? (
													<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
												) : (
													<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
												)}
											</button>
											{isExpanded && (
												<div className="border-t bg-muted/20 px-3 pb-3 pt-2">
													<Textarea
														placeholder="## Instructions..."
														value={file.content}
														onChange={(e) => update(file.updateKey, e.target.value)}
														className="min-h-[320px] font-mono text-sm resize-y"
													/>
												</div>
											)}
										</div>
									);
								})}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="validate" className="mt-0 h-full space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<ListChecks className="h-4 w-4" />
									Validation checklist
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									From the guide: validate before upload. Fix any unchecked items in Setup or Instructions.
								</p>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2">
									{validation.map((item) => (
										<li key={item.id} className="flex items-center gap-2 text-sm">
											{item.ok ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
											<span className={item.ok ? "" : "text-muted-foreground"}>{item.label}</span>
										</li>
									))}
								</ul>
								{allValid && (
									<p className="mt-3 text-sm text-green-600 flex items-center gap-1">
										<CheckCircle2 className="h-4 w-4" /> Ready to export.
									</p>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Export</CardTitle>
								<p className="text-sm text-muted-foreground">
									Download a full OpenClaw plugin ZIP (manifest, entry point, package.json, skill path). Install with{" "}
									<code className="text-xs bg-muted px-1 rounded">openclaw plugins install &lt;file.zip&gt;</code> or register in the Analytics tab for tracking.
								</p>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex flex-wrap gap-2">
									<Button onClick={() => void handleDownload()} disabled={!state.name} size="sm">
										<Download className="h-4 w-4 mr-2" />
										Download ZIP
									</Button>
								</div>
								<div className="rounded-md border bg-muted/30 p-3 font-mono text-xs overflow-x-auto">
									<pre className="whitespace-pre-wrap break-words">{`${suggestedName}/
├── openclaw.plugin.json
├── package.json          (name = "${suggestedName}")
├── index.js
├── agentready-analytics.json
├── agentready-telemetry.js
├── skills/${suggestedName}/
│   └── SKILL.md
├── scripts/     (optional)
├── references/  (optional)
└── assets/      (optional)`}</pre>
								</div>
								<details className="rounded-md border bg-muted/20">
									<summary className="cursor-pointer p-2 text-sm font-medium">Preview full SKILL.md</summary>
									<pre className="p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words border-t">{fullSkillMd}</pre>
								</details>
								<p className="text-xs text-muted-foreground">
									Add the plugin id to <code className="bg-muted px-1 rounded">plugins.allow</code> in OpenClaw config, then restart the gateway.
								</p>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="analytics" className="mt-0 h-full space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<BarChart3 className="h-4 w-4" />
									Register a plugin for analytics
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									Drop your plugin .zip here to register it. We&apos;ll give you a rebundled zip that&apos;s ready to distribute; when people use it, analytics will show up on this page.
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<Dropzone
									accept=".zip"
									dropMessage="Drop your plugin .zip here or click to choose"
									onChange={(files) => void handleAnalyticsZip(files)}
								/>
								{registerMutation.isPending && (
									<p className="text-sm text-muted-foreground">Registering and rebundling…</p>
								)}
								{pendingDownload && (
									<div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 space-y-2">
										<p className="text-sm font-medium text-green-800 dark:text-green-200">
											Ready to distribute
										</p>
										<p className="text-xs text-muted-foreground">
											Download the trackable zip and share it. Events will appear below.
										</p>
										<Button size="sm" onClick={downloadTrackableZip}>
											<Download className="h-4 w-4 mr-2" />
											Download trackable zip
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Registered skills</CardTitle>
								<p className="text-sm text-muted-foreground">
									Skills you&apos;ve registered for analytics. Usage from distributed plugins appears here.
								</p>
							</CardHeader>
							<CardContent>
								{listLoading ? (
									<p className="text-sm text-muted-foreground">Loading…</p>
								) : registrations.length === 0 ? (
									<p className="text-sm text-muted-foreground">No registered skills yet. Drop a zip above to register one.</p>
								) : (
									<ul className="space-y-3">
										{registrations.map((r) => (
											<AnalyticsRegistrationRow
												key={r.trackingId}
												trackingId={r.trackingId}
												name={r.name}
												pluginId={r.pluginId}
												createdAt={r.createdAt}
												onRemove={() => removeAnalyticsZip(r.trackingId)}
												removePending={removeMutation.isPending}
											/>
										))}
									</ul>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="clients" className="mt-0 h-full space-y-4">
						<SkillClientsPanel
							mcpUrl={clientsMcpUrl}
							displayName={clientsDisplayName}
							cliId={clientsCliId}
							skillDescription={clientsSkillDescription}
						/>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
