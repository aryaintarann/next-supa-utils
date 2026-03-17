"use client";

// ── Client entry point ──────────────────────────────────────────────
// This module MUST only be imported in Client Components.
// The "use client" directive ensures Next.js treats the entire
// sub-tree as client-side code.

export { SupaProvider, useSupaConfig } from "./SupaProvider";
export { useSupaUser } from "./hooks/useSupaUser";
export { useSupaSession } from "./hooks/useSupaSession";
export { useSupaUpload } from "./hooks/useSupaUpload";
export { useSupaRealtime } from "./hooks/useSupaRealtime";

// Re-export types consumers commonly need alongside client helpers.
export type {
  UseSupaUserReturn,
  UseSupaSessionReturn,
  UseSupaUploadReturn,
  UploadOptions,
  RealtimeEvent,
  RealtimePayload,
  SupaError,
} from "../types";
