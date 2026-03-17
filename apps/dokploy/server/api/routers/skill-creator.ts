import { TRPCError } from "@trpc/server";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/** Resolve AgentReady repo root (directory that contains both "apps" and "packages"). */
function findRepoRoot(startDir: string): string | null {
	let dir = path.resolve(startDir);
	for (let i = 0; i < 10; i++) {
		const appsDir = path.join(dir, "apps");
		const packagesDir = path.join(dir, "packages");
		if (fs.existsSync(appsDir) && fs.existsSync(packagesDir)) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

function readOpenAIKeyFromEnvFile(envPath: string): string | null {
	try {
		if (!fs.existsSync(envPath)) return null;
		const content = fs.readFileSync(envPath, "utf-8");
		for (const line of content.split("\n")) {
			const match = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)$/);
			if (match) {
				const value = match[1]!.trim().replace(/^["']|["']$/g, "");
				if (value) return value;
			}
		}
	} catch {
		// ignore
	}
	return null;
}

/** Load OPENAI_API_KEY from the main repo .env (AgentReady/.env) when not already set. */
function ensureOpenAIEnv(): void {
	if (process.env.OPENAI_API_KEY) return;
	// 1) Repo root by walking up from __dirname (source layout)
	const rootFromDirname = findRepoRoot(__dirname);
	if (rootFromDirname) {
		const value = readOpenAIKeyFromEnvFile(path.join(rootFromDirname, ".env"));
		if (value) {
			process.env.OPENAI_API_KEY = value;
			return;
		}
	}
	// 2) Repo root by walking up from process.cwd() (e.g. server started from apps/dokploy or AgentReady)
	const rootFromCwd = findRepoRoot(process.cwd());
	if (rootFromCwd) {
		const value = readOpenAIKeyFromEnvFile(path.join(rootFromCwd, ".env"));
		if (value) {
			process.env.OPENAI_API_KEY = value;
			return;
		}
	}
	// 3) Common relative paths when cwd is apps/dokploy: ../../.env = AgentReady/.env
	const cwd = process.cwd();
	for (const rel of [".env", path.join("..", ".env"), path.join("..", "..", ".env")]) {
		const value = readOpenAIKeyFromEnvFile(path.join(cwd, rel));
		if (value) {
			process.env.OPENAI_API_KEY = value;
			return;
		}
	}
}

const SKILL_CREATOR_DIR = path.join(process.cwd(), "server", "skills", "skill-creator");
const SKILL_MD_PATH = path.join(SKILL_CREATOR_DIR, "SKILL.md");

function loadSkillCreatorContent(): string {
	try {
		return fs.readFileSync(SKILL_MD_PATH, "utf-8");
	} catch {
		// Fallback if file not found (e.g. different cwd)
		return `You are the skill creator. When the user describes a skill they want, produce a complete SKILL.md:
- YAML frontmatter with --- delimiters: name (kebab-case), description (what it does + when to use it, be slightly "pushy" so the skill triggers when relevant).
- Then a blank line and the markdown body: clear instructions, steps, examples. No commentary. Output only the raw SKILL.md.`;
	}
}

type ParsedSkill = {
	name: string;
	description: string;
	body: string;
	license?: string;
	compatibility?: string;
	metadataAuthor?: string;
	metadataVersion?: string;
	metadataMcpServer?: string;
};

function parseSkillMd(raw: string): ParsedSkill {
	let text = raw.trim();
	// Strip optional markdown code fence
	const fenceMatch = text.match(/^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/);
	if (fenceMatch) text = fenceMatch[1]!.trim();
	// Split frontmatter and body
	const delim = "---";
	const first = text.indexOf(delim);
	if (first === -1) {
		return { name: "", description: "", body: text };
	}
	const afterFirst = text.slice(first + delim.length);
	const second = afterFirst.indexOf(delim);
	if (second === -1) {
		return { name: "", description: "", body: text };
	}
	const frontmatter = afterFirst.slice(0, second).trim();
	const body = afterFirst.slice(second + delim.length).trim();
	// Parse frontmatter (simple line-based)
	const out: ParsedSkill = { name: "", description: "", body };
	let inMetadata = false;
	for (const line of frontmatter.split("\n")) {
		const nm = line.match(/^name:\s*(.+)$/);
		if (nm) {
			out.name = nm[1]!.trim().replace(/^["']|["']$/g, "");
			continue;
		}
		const desc = line.match(/^description:\s*(.+)$/);
		if (desc) {
			out.description = desc[1]!.trim().replace(/^["']|["']$/g, "");
			continue;
		}
		const license = line.match(/^license:\s*(.+)$/);
		if (license) {
			out.license = license[1]!.trim().replace(/^["']|["']$/g, "");
			continue;
		}
		const compat = line.match(/^compatibility:\s*(.+)$/);
		if (compat) {
			out.compatibility = compat[1]!.trim().replace(/^["']|["']$/g, "");
			continue;
		}
		if (line.trim() === "metadata:") {
			inMetadata = true;
			continue;
		}
		if (inMetadata) {
			const author = line.match(/^\s*author:\s*(.+)$/);
			if (author) out.metadataAuthor = author[1]!.trim().replace(/^["']|["']$/g, "");
			const version = line.match(/^\s*version:\s*(.+)$/);
			if (version) out.metadataVersion = version[1]!.trim().replace(/^["']|["']$/g, "");
			const mcp = line.match(/^\s*mcp-server:\s*(.+)$/);
			if (mcp) out.metadataMcpServer = mcp[1]!.trim().replace(/^["']|["']$/g, "");
		}
	}
	return out;
}

export const skillCreatorRouter = createTRPCRouter({
	createFromDescription: protectedProcedure
		.input(z.object({ description: z.string().min(1).max(8000) }))
		.mutation(async ({ input }) => {
			ensureOpenAIEnv();
			const apiKey = process.env.OPENAI_API_KEY;
			if (!apiKey?.trim()) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "OPENAI_API_KEY is not set. Add it to the repo root .env (AgentReady/.env) and restart the server.",
				});
			}
			const skillCreatorContent = loadSkillCreatorContent();
			const systemPrompt = `${skillCreatorContent}

TASK: The user will describe a skill they want in one message. Reply with ONLY the complete SKILL.md content: YAML frontmatter between --- delimiters (name in kebab-case, description with what and when to use), then a blank line, then the markdown body. No commentary before or after. No code fence around your reply.`;

			const res = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: "gpt-4o-mini",
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: input.description },
					],
					max_tokens: 4096,
					temperature: 0.3,
				}),
			});
			if (!res.ok) {
				const err = await res.text();
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `OpenAI API error: ${res.status} ${err.slice(0, 200)}`,
				});
			}
			const data = (await res.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};
			const content = data.choices?.[0]?.message?.content;
			if (!content?.trim()) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "OpenAI returned no content",
				});
			}
			const parsed = parseSkillMd(content);
			// Normalize name to kebab if we got something
			if (parsed.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(parsed.name)) {
				parsed.name = parsed.name
					.trim()
					.toLowerCase()
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");
			}
			return {
				name: parsed.name,
				description: parsed.description,
				body: parsed.body,
				license: parsed.license ?? "",
				compatibility: parsed.compatibility ?? "",
				metadataAuthor: parsed.metadataAuthor ?? "",
				metadataVersion: parsed.metadataVersion ?? "",
				metadataMcpServer: parsed.metadataMcpServer ?? "",
			};
		}),
});
