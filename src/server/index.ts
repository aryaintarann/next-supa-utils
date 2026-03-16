// ── Server entry point ──────────────────────────────────────────────
// This module should ONLY be imported in server-side contexts:
// middleware.ts, Server Components, Server Actions, Route Handlers.

export { withSupaAuth } from "./middleware/withSupaAuth";
export { createAction } from "./actions/actionWrapper";

// Re-export types consumers commonly need alongside server helpers.
export type { SupaAuthConfig, ActionResponse, SupaError } from "../types";
