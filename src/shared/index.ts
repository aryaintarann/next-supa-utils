// ── Shared entry point ──────────────────────────────────────────────
// Re-exports types and utilities used across client & server modules.

export { handleSupaError } from "./utils/error-handler";

export type {
  SupaError,
  ActionResponse,
  MiddlewareOptions,
  RouteConfig,
  UseSupaUserReturn,
  UseSupaSessionReturn,
} from "../types";
