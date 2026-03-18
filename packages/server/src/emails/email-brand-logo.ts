/**
 * Absolute URL for the logo in transactional emails.
 * Set EMAIL_LOGO_URL, or configure app origin (NEXT_PUBLIC_WEB_URL / BETTER_AUTH_URL / NEXTAUTH_URL)
 * so `/agentready-logo.png` is reachable.
 */
export function emailBrandLogoUrl(): string | undefined {
	if (process.env.EMAIL_LOGO_URL) {
		return process.env.EMAIL_LOGO_URL;
	}
	const base =
		process.env.NEXT_PUBLIC_WEB_URL ||
		process.env.BETTER_AUTH_URL ||
		process.env.NEXTAUTH_URL;
	if (!base) {
		return undefined;
	}
	return `${String(base).replace(/\/$/, "")}/agentready-logo.png`;
}
