import type { SupaError } from "../../types";

/**
 * Normalize any thrown value into a consistent `SupaError` shape.
 *
 * Handles:
 * - Supabase `AuthError` / `PostgrestError` (has `.message` and optional `.code` / `.status`)
 * - Standard `Error` instances
 * - Plain strings
 * - Unknown values (fallback)
 */
export function handleSupaError(error: unknown): SupaError {
  // ── Supabase errors & standard Error instances ──────────────────
  if (error instanceof Error) {
    const record = error as unknown as Record<string, unknown>;
    return {
      message: error.message,
      code: typeof record.code === "string" ? record.code : undefined,
      status: typeof record.status === "number" ? record.status : undefined,
    };
  }

  // ── Plain object with a message property ────────────────────────
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    const err = error as Record<string, unknown>;
    return {
      message: err.message as string,
      code: typeof err.code === "string" ? err.code : undefined,
      status: typeof err.status === "number" ? err.status : undefined,
    };
  }

  // ── String ──────────────────────────────────────────────────────
  if (typeof error === "string") {
    return { message: error };
  }

  // ── Fallback ────────────────────────────────────────────────────
  return { message: "An unknown error occurred" };
}
