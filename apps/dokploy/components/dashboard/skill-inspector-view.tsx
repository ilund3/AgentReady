"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";

const KEBAB_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 1024;
const RESERVED_NAMES = ["claude", "anthropic"];

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

export function SkillInspectorView() {
	const [state, setState] = useState<SkillState>(INITIAL_STATE);
	const [activeTab, setActiveTab] = useState("setup");

	const update = useCallback(<K extends keyof SkillState>(key: K, value: SkillState[K]) => {
		setState((prev) => ({ ...prev, [key]: value }));
	}, []);

	const suggestedName = useMemo(() => toKebab(state.name || "your-skill-name"), [state.name]);

	const validation = useMemo(() => {
		return CHECKLIST_ITEMS.map((item) => ({
			...item,
			ok: item.check(state),
		}));
	}, [state]);

	const fullSkillMd = useMemo(() => buildSkillMd(state), [state]);

	const handleDownload = useCallback(() => {
		const blob = new Blob([fullSkillMd], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "SKILL.md";
		a.click();
		URL.revokeObjectURL(url);
		toast.success("SKILL.md downloaded");
	}, [fullSkillMd]);

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
					<TabsList className="grid w-full max-w-md grid-cols-3">
						<TabsTrigger value="setup">Setup</TabsTrigger>
						<TabsTrigger value="instructions">Instructions</TabsTrigger>
						<TabsTrigger value="validate">Validate & Export</TabsTrigger>
					</TabsList>
				</div>

				<div className="flex-1 overflow-auto p-4">
					<TabsContent value="setup" className="mt-0 h-full">
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
									SKILL.md body
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									Main instructions in Markdown. Use steps, examples, and troubleshooting. Link to references/ for long docs.
								</p>
							</CardHeader>
							<CardContent>
								<Textarea
									placeholder="## Instructions..."
									value={state.body}
									onChange={(e) => update("body", e.target.value)}
									className="min-h-[320px] font-mono text-sm resize-y"
								/>
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
									Download SKILL.md and place it in a folder named like your skill (kebab-case). Add scripts/, references/, assets/ as needed.
								</p>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex flex-wrap gap-2">
									<Button onClick={handleDownload} disabled={!state.name} size="sm">
										<Download className="h-4 w-4 mr-2" />
										Download SKILL.md
									</Button>
								</div>
								<div className="rounded-md border bg-muted/30 p-3 font-mono text-xs overflow-x-auto">
									<pre className="whitespace-pre-wrap break-words">{`${state.name || "your-skill-name"}/
├── SKILL.md
├── scripts/     (optional)
├── references/  (optional)
└── assets/      (optional)`}</pre>
								</div>
								<details className="rounded-md border bg-muted/20">
									<summary className="cursor-pointer p-2 text-sm font-medium">Preview full SKILL.md</summary>
									<pre className="p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words border-t">{fullSkillMd}</pre>
								</details>
								<p className="text-xs text-muted-foreground">
									To distribute: zip the skill folder and upload to Claude.ai via Settings → Capabilities → Skills, or place in Claude Code skills directory.
								</p>
							</CardContent>
						</Card>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
