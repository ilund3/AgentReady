"use client";

import { api } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	ArrowLeft,
	BarChart3,
	ClipboardCopy,
	FlaskConical,
	Radio,
	RefreshCw,
} from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export function SkillAnalyticsDashboard() {
	const router = useRouter();
	const trackingId = typeof router.query.trackingId === "string" ? router.query.trackingId : "";

	const utils = api.useUtils();
	const { data, isLoading, error, refetch } = api.skillAnalytics.dashboard.useQuery(
		{ trackingId },
		{ enabled: !!trackingId },
	);

	const { data: recent } = api.skillAnalytics.recentEvents.useQuery(
		{ trackingId, limit: 100 },
		{ enabled: !!trackingId },
	);

	const testMutation = api.skillAnalytics.sendTestEvent.useMutation({
		onSuccess: () => {
			toast.success("Test event stored");
			void utils.skillAnalytics.dashboard.invalidate({ trackingId });
			void utils.skillAnalytics.recentEvents.invalidate({ trackingId });
			void utils.skillAnalytics.getSummary.invalidate({ trackingId });
		},
		onError: (e) => toast.error(e.message),
	});

	const curlExample = useMemo(() => {
		if (!data?.ingestUrl) return "";
		const body = JSON.stringify({
			events: [{ eventType: "manual_curl_test", payload: { t: Date.now() } }],
		});
		return `curl -sS -X POST '${data.ingestUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '${body.replace(/'/g, "'\\''")}'`;
	}, [data?.ingestUrl]);

	const [copied, setCopied] = useState(false);

	if (!router.isReady) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}
	if (!trackingId) {
		return <p className="text-sm text-destructive">Missing tracking ID</p>;
	}
	if (error) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-destructive">{error.message}</p>
					<Button asChild variant="outline" className="mt-4">
						<Link href="/dashboard/skill-inspector">Back to Skill Inspector</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-3">
				<Button variant="ghost" size="sm" asChild>
					<Link href="/dashboard/skill-inspector">
						<ArrowLeft className="h-4 w-4 mr-1" />
						Skill Inspector
					</Link>
				</Button>
				<h1 className="text-xl font-semibold flex items-center gap-2">
					<BarChart3 className="h-6 w-6" />
					{isLoading ? "…" : data?.registration.name ?? "Skill analytics"}
				</h1>
				{data?.registration.pluginId && (
					<Badge variant="secondary">{data.registration.pluginId}</Badge>
				)}
				<Button variant="outline" size="sm" onClick={() => void refetch()}>
					<RefreshCw className="h-4 w-4 mr-1" />
					Refresh
				</Button>
			</div>

			<p className="text-sm text-muted-foreground font-mono break-all">{trackingId}</p>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[
					{ label: "All time", value: data?.counts.allTime ?? "—" },
					{ label: "Today (UTC)", value: data?.counts.todayUtc ?? "—" },
					{ label: "Last 24h", value: data?.counts.last24Hours ?? "—" },
					{ label: "Last 7 days", value: data?.counts.last7Days ?? "—" },
				].map((c) => (
					<Card key={c.label}>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-semibold tabular-nums">{isLoading ? "…" : c.value}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<FlaskConical className="h-4 w-4" />
						Debug ingest
					</CardTitle>
					<p className="text-sm text-muted-foreground">
						Verify the pipeline end-to-end. A test event only proves AgentReady DB + UI — not that OpenClaw can reach
						this URL.
					</p>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							onClick={() => testMutation.mutate({ trackingId })}
							disabled={testMutation.isPending}
						>
							<Radio className="h-4 w-4 mr-1" />
							Record test event (dashboard)
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={!curlExample}
							onClick={() => {
								void navigator.clipboard.writeText(curlExample);
								setCopied(true);
								toast.success("curl copied");
								setTimeout(() => setCopied(false), 2000);
							}}
						>
							<ClipboardCopy className="h-4 w-4 mr-1" />
							{copied ? "Copied" : "Copy curl (any machine)"}
						</Button>
					</div>
					<pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
						{curlExample || "…"}
					</pre>
					<ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
						<li>{data?.debug.serverIngestLog}</li>
						<li>{data?.debug.openclawDebug}</li>
						<li>
							After installing the trackable zip, restart OpenClaw gateway. Send a real message on a channel
							(Telegram, etc.) — hooks fire on the agent loop, not in the browser.
						</li>
					</ul>
				</CardContent>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card className="min-h-[280px]">
					<CardHeader>
						<CardTitle className="text-base">Activity by hour (UTC, last 7d)</CardTitle>
						<p className="text-xs text-muted-foreground">When hooks fire across the day</p>
					</CardHeader>
					<CardContent className="h-[220px]">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={data?.activityByHourUtc7d ?? []}>
								<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
								<XAxis dataKey="hour" tick={{ fontSize: 10 }} />
								<YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
								<Tooltip />
								<Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>

				<Card className="min-h-[280px]">
					<CardHeader>
						<CardTitle className="text-base">Events by type (7d)</CardTitle>
					</CardHeader>
					<CardContent className="h-[220px]">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart
								layout="vertical"
								data={Object.entries(data?.byEventType7d ?? {}).map(([name, count]) => ({
									name,
									count,
								}))}
								margin={{ left: 8, right: 16 }}
							>
								<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
								<XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
								<YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9 }} />
								<Tooltip />
								<Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 2, 2, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">By channel (7d)</CardTitle>
						<p className="text-xs text-muted-foreground">From message_* / agent_end payloads</p>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2 text-sm">
							{(data?.byChannel7d ?? []).length === 0 ? (
								<li className="text-muted-foreground">No channel-tagged events yet</li>
							) : (
								data!.byChannel7d.map((r) => (
									<li key={r.channel} className="flex justify-between gap-2">
										<span className="font-mono truncate">{r.channel}</span>
										<span className="tabular-nums shrink-0">{r.count}</span>
									</li>
								))
							)}
						</ul>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Top tools (7d)</CardTitle>
						<p className="text-xs text-muted-foreground">before_tool_call / after_tool_call</p>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2 text-sm">
							{(data?.topTools7d ?? []).length === 0 ? (
								<li className="text-muted-foreground">No tool events yet</li>
							) : (
								data!.topTools7d.map((r) => (
									<li key={r.tool} className="flex justify-between gap-2">
										<span className="font-mono truncate">{r.tool}</span>
										<span className="tabular-nums shrink-0">{r.count}</span>
									</li>
								))
							)}
						</ul>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Daily volume (UTC, 14d)</CardTitle>
				</CardHeader>
				<CardContent className="h-[240px]">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data?.activityByDayUtc14d ?? []}>
							<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
							<XAxis dataKey="day" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={60} />
							<YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
							<Tooltip />
							<Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent events (100)</CardTitle>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead>
							<tr className="border-b">
								<th className="p-2">Time</th>
								<th className="p-2">Type</th>
								<th className="p-2">Payload</th>
							</tr>
						</thead>
						<tbody>
							{(recent?.events ?? []).map((ev) => (
								<tr key={ev.id} className="border-b border-border/40 align-top">
									<td className="p-2 whitespace-nowrap text-muted-foreground">
										{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : "—"}
									</td>
									<td className="p-2 font-mono">{ev.eventType}</td>
									<td className="p-2 font-mono text-[10px] max-w-md break-all">
										{ev.payload != null ? JSON.stringify(ev.payload) : "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{(recent?.events ?? []).length === 0 && (
						<p className="text-sm text-muted-foreground py-4">No events yet.</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
