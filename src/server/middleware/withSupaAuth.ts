import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { SupaAuthConfig } from "../../types";

/**
 * Create a Next.js middleware handler that protects routes based on
 * Supabase authentication state.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { withSupaAuth } from "next-supa-utils/server";
 *
 * export default withSupaAuth({
 *   protectedRoutes: ["/dashboard", "/admin"],
 *   redirectTo: "/login",
 *   publicRoutes: ["/admin/login"],
 * });
 *
 * export const config = {
 *   matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
 * };
 * ```
 */
export function withSupaAuth(config: SupaAuthConfig) {
  const {
    protectedRoutes,
    redirectTo = "/login",
    publicRoutes = [],
    onAuthSuccess,
  } = config;

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
          // Forward cookies to the request so downstream server
          // components can read the updated session.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Re-create the response so it carries the updated request.
          response = NextResponse.next({ request });

          // Set cookies on the outgoing response so the browser
          // stores the refreshed tokens.
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

    // ── 4. Check if current path matches a public override ────────
    const isPublicRoute = publicRoutes.some((route) =>
      pathname.startsWith(route),
    );

    if (isPublicRoute) {
      return response;
    }

    // ── 5. Check if current path requires authentication ──────────
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route),
    );

    if (isProtectedRoute && !user) {
      const loginUrl = new URL(redirectTo, request.url);
      // Preserve the originally-requested URL so the app can redirect
      // back after login.
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ── 6. Optional success callback ──────────────────────────────
    if (user && onAuthSuccess) {
      await onAuthSuccess({ id: user.id, email: user.email ?? undefined });
    }

    return response;
  };
}
