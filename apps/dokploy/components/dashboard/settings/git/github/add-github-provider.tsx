import { format } from "date-fns";
import { useEffect, useState } from "react";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/utils/api";

export const AddGithubProvider = () => {
	const [isOpen, setIsOpen] = useState(false);
	const { data: activeOrganization } = api.organization.active.useQuery();

	const { data: session } = api.user.session.useQuery();
	const { data } = api.user.get.useQuery();
	const [manifest, setManifest] = useState("");
	const [isOrganization, setIsOrganization] = useState(false);
	const [organizationName, setOrganization] = useState("");

	const randomString = () => Math.random().toString(36).slice(2, 8);

	useEffect(() => {
		// GitHub requires webhook URL to be reachable from the public internet (no localhost).
		// Set NEXT_PUBLIC_APP_URL to your public URL (e.g. https://your-domain.com or an ngrok/localtunnel URL for local dev).
		const baseUrl =
			typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
			process.env.NEXT_PUBLIC_APP_URL.trim() !== ""
				? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
				: document.location.origin;
		const manifest = JSON.stringify(
			{
				redirect_url: `${baseUrl}/api/providers/github/setup?organizationId=${activeOrganization?.id ?? ""}&userId=${session?.user?.id ?? ""}`,
				name: `AgentReady-${format(new Date(), "yyyy-MM-dd")}-${randomString()}`,
				url: baseUrl,
				hook_attributes: {
					url: `${baseUrl}/api/deploy/github`,
				},
				callback_urls: [`${baseUrl}/api/providers/github/setup`],
				public: false,
				request_oauth_on_install: true,
				default_permissions: {
					contents: "read",
					metadata: "read",
					emails: "read",
					pull_requests: "write",
				},
				default_events: ["pull_request", "push"],
			},
			null,
			4,
		);

		setManifest(manifest);
	}, [activeOrganization?.id, session?.user?.id]);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="secondary" className="flex items-center space-x-1">
					<GithubIcon className="text-current fill-current" />
					<span>Github</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl ">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Github Provider <GithubIcon className="size-5" />
					</DialogTitle>
				</DialogHeader>

				<div id="hook-form-add-project" className="grid w-full gap-1">
					<CardContent className="p-0">
						<div className="flex flex-col ">
							<p className="text-muted-foreground text-sm">
								To integrate your GitHub account with our services, you'll need
								to create and install a GitHub app. This process is
								straightforward and only takes a few minutes. Click the button
								below to get started.
							</p>
							{typeof window !== "undefined" &&
								(document.location.origin.startsWith("http://localhost") ||
									document.location.origin.startsWith("http://127.0.0.1")) &&
								!process.env.NEXT_PUBLIC_APP_URL && (
									<p className="text-amber-600 dark:text-amber-500 text-sm">
										GitHub requires webhook URLs to be reachable from the
										internet. Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_APP_URL</code> in
										your env to a public URL (e.g. ngrok or your deployed domain),
										then restart the app.
									</p>
								)}
							<div className="mt-4 flex flex-col gap-4">
								<div className="flex flex-row gap-4">
									<span>Organization?</span>
									<Switch
										checked={isOrganization}
										onCheckedChange={(checked) => setIsOrganization(checked)}
									/>
								</div>

								{isOrganization && (
									<Input
										required
										placeholder="Organization name"
										onChange={(e) => setOrganization(e.target.value)}
									/>
								)}
							</div>
							<form
								action={
									isOrganization
										? `https://github.com/organizations/${organizationName}/settings/apps/new?state=gh_init:${activeOrganization?.id}:${session?.user?.id ?? ""}`
										: `https://github.com/settings/apps/new?state=gh_init:${activeOrganization?.id}:${session?.user?.id ?? ""}`
								}
								method="post"
							>
								<input
									type="text"
									name="manifest"
									id="manifest"
									defaultValue={manifest}
									className="invisible"
								/>
								<br />

								<div className="flex w-full items-center justify-between">
									<a
										href={
											isOrganization && organizationName
												? `https://github.com/organizations/${organizationName}/settings/installations`
												: "https://github.com/settings/installations"
										}
										className={`text-muted-foreground text-sm hover:underline duration-300
											 ${
													isOrganization && !organizationName
														? "pointer-events-none opacity-50"
														: ""
												}`}
										target="_blank"
										rel="noopener noreferrer"
									>
										Unsure if you already have an app?
									</a>
									<Button
										disabled={isOrganization && organizationName.length < 1}
										type="submit"
										className="self-end"
									>
										Create GitHub App
									</Button>
								</div>
							</form>
						</div>
					</CardContent>
				</div>
			</DialogContent>
		</Dialog>
	);
};
