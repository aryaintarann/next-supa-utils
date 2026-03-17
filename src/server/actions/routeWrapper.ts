import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { RouteWrapperOptions, SupaError } from "../../types";
import { handleSupaError } from "../../shared/utils/error-handler";

/**
 * Higher-order function that wraps a Next.js App Router Route Handler
 * with standardized error handling and optional authentication gating.
 *
 * @example
 * ```ts
 * // app/api/posts/route.ts
 * import { routeWrapper } from "next-supa-utils/server";
 *
 * // Public endpoint (no auth required)
 * export const GET = routeWrapper(async (request) => {
 *   const data = await fetchPosts();
 *   return NextResponse.json({ data });
 * });
 *
 * // Protected endpoint (requires valid Supabase session)
 * export const POST = routeWrapper(
 *   async (request, { supabase, user }) => {
 *     const body = await request.json();
 *     const { data, error } = await supabase
 *       .from("posts")
 *       .insert({ ...body, user_id: user.id })
 *       .select()
 *       .single();
 *
 *     if (error) throw error;
 *     return NextResponse.json({ data }, { status: 201 });
 *   },
 *   { requireAuth: true },
 * );
 * ```
 */
export function routeWrapper<TContext extends Record<string, unknown> = Record<string, unknown>>(
  handler: (
    request: NextRequest,
    context: RouteHandlerContext<TContext>,
  ) => Promise<NextResponse | Response>,
  options?: RouteWrapperOptions,
) {
  const { requireAuth = false } = options ?? {};

  return async (
    request: NextRequest,
    routeContext?: { params?: Promise<TContext> },
  ): Promise<NextResponse> => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
          { error: { message: "Server configuration error", code: "CONFIG_ERROR" } },
          { status: 500 },
        );
      }

      // ── Build context to pass to the handler ────────────────────
      const ctx: RouteHandlerContext<TContext> = {
        params: routeContext?.params ? await routeContext.params : ({} as TContext),
        supabase: null as unknown as SupabaseClient,
        user: null,
      };

      // ── Optionally init Supabase & check auth ───────────────────
      if (requireAuth) {
        const cookieStore = await cookies();

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
              try {
                cookiesToSet.forEach(({ name, value, options: opts }) => {
                  cookieStore.set(name, value, opts);
                });
              } catch {
                // cookies().set() may throw in read-only contexts
              }
            },
          },
        });

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          return NextResponse.json(
            {
              error: {
                message: "Unauthorized: valid session required",
                code: "UNAUTHORIZED",
              } satisfies SupaError,
            },
            { status: 401 },
          );
        }

        ctx.supabase = supabase;
        ctx.user = user;
      } else {
        // Even for public routes, provide a Supabase client for convenience.
        const cookieStore = await cookies();

        ctx.supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
              try {
                cookiesToSet.forEach(({ name, value, options: opts }) => {
                  cookieStore.set(name, value, opts);
                });
              } catch {
                // cookies().set() may throw in read-only contexts
              }
            },
          },
        });
      }

      // ── Execute the handler ─────────────────────────────────────
      const response = await handler(request, ctx);
      return response instanceof NextResponse
        ? response
        : NextResponse.json(await response.json(), { status: response.status });
    } catch (caught: unknown) {
      const error = handleSupaError(caught);
      const status = error.status ?? 500;

      return NextResponse.json({ error }, { status });
    }
  };
}

// ── Internal context type ───────────────────────────────────────────

/** Context object passed to the route handler by `routeWrapper`. */
export interface RouteHandlerContext<
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Resolved dynamic route params (e.g. `{ id: "123" }`). */
  params: TParams;

  /**
   * Supabase server client.
   * Always available (even on public routes) for convenience queries.
   */
  supabase: SupabaseClient;

  /**
   * The authenticated user, or `null` for public (non-auth) routes.
   * Guaranteed non-null when `requireAuth: true`.
   */
  user: Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
}
