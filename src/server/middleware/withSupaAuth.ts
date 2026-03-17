import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { MiddlewareOptions, RouteConfig } from "../../types";

// ── Path matching utility ───────────────────────────────────────────

/**
 * Converts a route pattern into a RegExp for matching.
 *
 * Supports:
 * - Exact:    `"/settings"`       → matches only `/settings`
 * - Prefix:   `"/dashboard"`      → matches `/dashboard`, `/dashboard/stats`
 * - Wildcard: `"/admin/:path*"`   → matches `/admin`, `/admin/users`, `/admin/a/b/c`
 */
function matchPath(pattern: string, pathname: string): boolean {
  // Wildcard pattern: "/admin/:path*" → match "/admin" and everything below
  if (pattern.includes(":path*")) {
    const prefix = pattern.replace(/:path\*$/, "").replace(/\/$/, "");
    return pathname === prefix || pathname.startsWith(prefix + "/");
  }

  // Prefix matching: "/dashboard" matches "/dashboard/anything"
  return pathname === pattern || pathname.startsWith(pattern + "/");
}

/**
 * Finds the first `RouteConfig` whose pattern matches `pathname`, or `undefined`.
 */
function findMatchingRoute(
  routes: RouteConfig[],
  pathname: string,
): RouteConfig | undefined {
  return routes.find((route) => matchPath(route.path, pathname));
}

// ── Role extraction utility ─────────────────────────────────────────

type UserMeta = {
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
};

function extractRole(
  user: UserMeta,
  extractor: MiddlewareOptions["roleExtractor"],
): string | string[] | undefined {
  if (typeof extractor === "function") {
    return extractor(user);
  }

  const source =
    extractor === "app_metadata" ? user.app_metadata : user.user_metadata;

  const raw = source?.role;

  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.every((r) => typeof r === "string")) {
    return raw as string[];
  }

  return undefined;
}

/**
 * Check whether the user's role(s) satisfy the route's `allowedRoles`.
 */
function hasRequiredRole(
  userRole: string | string[] | undefined,
  allowedRoles: string[] | undefined,
): boolean {
  // No role restriction → any authenticated user is allowed.
  if (!allowedRoles || allowedRoles.length === 0) return true;

  if (!userRole) return false;

  const roles = Array.isArray(userRole) ? userRole : [userRole];
  return roles.some((r) => allowedRoles.includes(r));
}

// ── Main middleware factory ─────────────────────────────────────────

/**
 * Create a Next.js middleware handler that protects routes with
 * authentication **and** optional role-based access control (RBAC).
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { withSupaAuth } from "next-supa-utils/server";
 *
 * export default withSupaAuth({
 *   routes: [
 *     { path: "/dashboard" },                                    // any authed user
 *     { path: "/admin/:path*", allowedRoles: ["admin"] },        // admin only
 *     { path: "/editor/:path*", allowedRoles: ["admin", "editor"] },
 *   ],
 *   redirectTo: "/login",
 *   roleExtractor: "user_metadata", // or "app_metadata" or a custom fn
 * });
 *
 * export const config = {
 *   matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
 * };
 * ```
 */
export function withSupaAuth(options: MiddlewareOptions) {
  const {
    routes,
    redirectTo = "/login",
    roleExtractor = "user_metadata",
    onAuthSuccess,
  } = options;

  return async function middleware(request: NextRequest): Promise<NextResponse> {
    // ── 1. Create a mutable response so Supabase can set cookies ──
    let response = NextResponse.next({
      request: { headers: request.headers },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        "[next-supa-utils] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
      );
      return response;
    }

    // ── 2. Initialize server client with middleware cookie helpers ─
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // ── 3. Refresh session (required to keep tokens alive) ────────
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // ── 4. Find the matching route config ─────────────────────────
    const matchedRoute = findMatchingRoute(routes, pathname);

    // No matching route → not a protected path, pass through.
    if (!matchedRoute) {
      return response;
    }

    // ── 5. Check authentication ───────────────────────────────────
    if (!user) {
      const loginUrl = new URL(redirectTo, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ── 6. Check role-based access ────────────────────────────────
    const userRole = extractRole(user, roleExtractor);

    if (!hasRequiredRole(userRole, matchedRoute.allowedRoles)) {
      // User is logged in but lacks the required role.
      const forbiddenUrl = new URL(redirectTo, request.url);
      forbiddenUrl.searchParams.set("error", "forbidden");
      forbiddenUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(forbiddenUrl);
    }

    // ── 7. Success callback ───────────────────────────────────────
    if (onAuthSuccess) {
      await onAuthSuccess({
        id: user.id,
        email: user.email ?? undefined,
        role: userRole,
      });
    }

    return response;
  };
}
