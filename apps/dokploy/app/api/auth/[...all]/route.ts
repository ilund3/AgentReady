import { authInstance } from "@dokploy/server/index";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * App Router auth handler. Used so /api/auth/* (e.g. sign-in/social) works in dev
 * and prod. Pages Router catch-all (pages/api/auth/[...all].ts) can 404 in dev
 * with custom server; this route takes precedence and handles the same paths.
 */
export const { GET, POST } = toNextJsHandler(authInstance);
