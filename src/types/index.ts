import type { SupabaseClient } from "@supabase/supabase-js";

// ── Error types ─────────────────────────────────────────────────────

/** Standardized error shape returned by all next-supa-utils helpers. */
export interface SupaError {
  message: string;
  code?: string;
  status?: number;
}

// ── Server Action response ──────────────────────────────────────────

/** Discriminated success/failure response returned by `createAction`. */
export type ActionResponse<T> =
  | { data: T; error: null }
  | { data: null; error: SupaError };

// ── Middleware configuration ────────────────────────────────────────

export interface SupaAuthConfig {
  /**
   * Route prefixes that require an authenticated user.
   * Supports simple prefix matching.
   *
   * @example ["/dashboard", "/admin", "/settings"]
   */
  protectedRoutes: string[];

  /**
   * Where to redirect unauthenticated users.
   * @default "/login"
   */
  redirectTo?: string;

  /**
   * Routes that are always public, even if they match a protected prefix.
   *
   * @example ["/admin/login"]
   */
  publicRoutes?: string[];

  /**
   * Optional callback invoked after session refresh,
   * before the redirect decision. Useful for custom logging or headers.
   */
  onAuthSuccess?: (user: { id: string; email?: string }) => void | Promise<void>;
}

// ── Hook return types ───────────────────────────────────────────────

export interface UseSupaUserReturn {
  user: Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
  loading: boolean;
  error: SupaError | null;
}

export interface UseSupaSessionReturn {
  session: Awaited<
    ReturnType<SupabaseClient["auth"]["getSession"]>
  >["data"]["session"];
  loading: boolean;
  error: SupaError | null;
}
