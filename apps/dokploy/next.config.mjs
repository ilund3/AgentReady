/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (AgentReady) so Turbopack doesn’t pick ~/package-lock.json as workspace root. */
const monorepoRoot = path.join(__dirname, "..", "..");

/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	turbopack: {
		root: monorepoRoot,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	transpilePackages: ["@dokploy/server"],
	// ssh2 and bcrypt use native Node.js addons (.node files) that webpack
	// cannot bundle. Mark them as server-side externals so Next.js loads them
	// via require() at runtime instead of attempting to bundle them.
	serverExternalPackages: ["ssh2", "cpu-features", "bcrypt"],
	webpack: (config, { isServer }) => {
		config.resolve.alias["@inspector"] = path.join(__dirname, "inspector");
		if (isServer) {
			// ssh2 and bcrypt include native .node binaries that webpack cannot
			// parse. Add them as externals so Node.js require() loads them at
			// runtime rather than webpack attempting to bundle them.
			const existing = Array.isArray(config.externals) ? config.externals : [];
			config.externals = [...existing, "ssh2", "cpu-features", "bcrypt"];
		}
		return config;
	},
	async headers() {
		return [
			{
				// Apply security headers to all routes
				source: "/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Content-Security-Policy",
						value: "frame-ancestors 'none'",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
				],
			},
		];
	},
};

export default nextConfig;
