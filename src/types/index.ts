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
   * Explicit Supabase Project URL.
   * If omitted, falls back to `process.env.NEXT_PUBLIC_SUPABASE_URL`.
   */
  supabaseUrl?: string;

  /**
   * Explicit Supabase Anon Key.
   * If omitted, falls back to `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   */
  supabaseAnonKey?: string;

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

// ── Route Handler wrapper configuration ─────────────────────────────

/** Options for the `routeWrapper` higher-order function. */
export interface RouteWrapperOptions {
  /**
   * If `true`, the wrapper will initialise a Supabase server client,
   * verify the session via `getUser()`, and reject with 401 if invalid.
   * The `context.supabase` and `context.user` are guaranteed non-null.
   *
   * @default false
   */
  requireAuth?: boolean;

  /**
   * Explicit Supabase Project URL.
   * If omitted, falls back to `process.env.NEXT_PUBLIC_SUPABASE_URL`.
   */
  supabaseUrl?: string;

  /**
   * Explicit Supabase Anon Key.
   * If omitted, falls back to `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   */
  supabaseAnonKey?: string;
}

// ── Server Action configuration ─────────────────────────────────────

/** Options for the `createAction` wrapper. */
export interface ServerActionOptions {
  /**
   * Explicit Supabase Project URL.
   * If omitted, falls back to `process.env.NEXT_PUBLIC_SUPABASE_URL`.
   */
  supabaseUrl?: string;

  /**
   * Explicit Supabase Anon Key.
   * If omitted, falls back to `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   */
  supabaseAnonKey?: string;
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

// ── Upload hook types ───────────────────────────────────────────────

/** Options passed to the `upload` function from `useSupaUpload`. */
export interface UploadOptions {
  /**
   * The storage path (including filename) where the file will be saved.
   * If omitted, defaults to `file.name`.
   *
   * @example "avatars/user-123.png"
   */
  path?: string;

  /**
   * Whether to overwrite an existing file at the same path.
   * @default false
   */
  upsert?: boolean;

  /**
   * Cache-Control header value for the uploaded file.
   * @default "3600"
   */
  cacheControl?: string;

  /**
   * MIME type of the file. Defaults to the File's own type.
   */
  contentType?: string;
}

/** Return type of the `useSupaUpload` hook. */
export interface UseSupaUploadReturn {
  /** Upload a file to the configured bucket. */
  upload: (file: File, options?: UploadOptions) => Promise<void>;

  /** `true` while an upload is in progress. */
  isUploading: boolean;

  /**
   * Upload progress percentage (0–100).
   * Updates in real-time as bytes are sent via `XMLHttpRequest`.
   */
  progress: number;

  /** Upload result data on success, or `null`. */
  data: { path: string; fullPath: string } | null;

  /** Error details on failure, or `null`. */
  error: SupaError | null;

  /** Reset all state (isUploading, progress, data, error) to initial values. */
  reset: () => void;

  /** Abort the current in-flight upload. */
  cancel: () => void;
}

// ── Realtime hook types ─────────────────────────────────────────────

/** Postgres change event types supported by Supabase Realtime. */
export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

/** Payload received from a Supabase Realtime postgres_changes event. */
export interface RealtimePayload<T extends Record<string, unknown> = Record<string, unknown>> {
  /** The type of event that triggered the change. */
  eventType: "INSERT" | "UPDATE" | "DELETE";

  /** The new row data (present on INSERT and UPDATE). */
  new: T;

  /** The old row data (present on UPDATE and DELETE). */
  old: Partial<T>;

  /** The database schema (e.g. "public"). */
  schema: string;

  /** The table name. */
  table: string;

  /** Timestamp of the change. */
  commit_timestamp: string;

  /** Any additional errors from the event. */
  errors: string[] | null;
}
