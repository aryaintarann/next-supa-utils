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

// ── Middleware configuration (RBAC) ─────────────────────────────────

/**
 * Defines a protected route with optional role-based access control.
 *
 * @example
 * ```ts
 * { path: "/admin/:path*", allowedRoles: ["admin", "super_admin"] }
 * ```
 */
export interface RouteConfig {
  /**
   * Route pattern to match.
   *
   * Supports:
   * - Exact paths: `"/settings"`
   * - Prefix matching: `"/dashboard"` matches `/dashboard/anything`
   * - Wildcards: `"/admin/:path*"` matches `/admin/users`, `/admin/settings/edit`, etc.
   */
  path: string;

  /**
   * Roles that are allowed to access this route.
   *
   * - If **omitted or empty**, any *authenticated* user can access the route.
   * - If **provided**, only users whose role is in this list are allowed.
   *
   * @example ["admin", "editor"]
   */
  allowedRoles?: string[];
}

/**
 * Configuration for the `withSupaAuth` middleware.
 */
export interface MiddlewareOptions {
  /**
   * Protected route definitions. Each entry can optionally restrict access
   * to specific roles via `allowedRoles`.
   */
  routes: RouteConfig[];

  /**
   * Where to redirect unauthenticated or unauthorized users.
   * @default "/login"
   */
  redirectTo?: string;

  /**
   * Strategy for extracting the user's role from the Supabase user object.
   *
   * - `"user_metadata"` — reads `user.user_metadata.role`
   * - `"app_metadata"` — reads `user.app_metadata.role`
   * - A custom function for advanced scenarios (e.g. multiple roles, JWT claims).
   *
   * @default "user_metadata"
   */
  roleExtractor?:
    | "user_metadata"
    | "app_metadata"
    | ((user: { user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> }) => string | string[] | undefined);

  /**
   * Optional callback invoked when a user is authenticated and authorized.
   * Useful for logging, analytics, or injecting custom response headers.
   */
  onAuthSuccess?: (user: {
    id: string;
    email?: string;
    role?: string | string[];
  }) => void | Promise<void>;
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
