import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionResponse, SupaError } from "../../types";
import { handleSupaError } from "../../shared/utils/error-handler";

/**
 * Create a type-safe Server Action that automatically:
 * 1. Initialises a Supabase server client (with cookies)
 * 2. Wraps execution in try/catch
 * 3. Returns a standardised `{ data, error }` response
 *
 * @example
 * ```ts
 * // app/actions/profile.ts
 * "use server";
 * import { createAction } from "next-supa-utils/server";
 *
 * export const getProfile = createAction(async (supabase, userId: string) => {
 *   const { data, error } = await supabase
 *     .from("profiles")
 *     .select("*")
 *     .eq("id", userId)
 *     .single();
 *
 *   if (error) throw error;
 *   return data;
 * });
 *
 * // Usage in a Server Component or Client Component:
 * const result = await getProfile("user-uuid");
 * if (result.error) { ... }
 * ```
 */
export function createAction<TArgs extends unknown[], TResult>(
  fn: (supabase: SupabaseClient, ...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<ActionResponse<TResult>> {
  return async (...args: TArgs): Promise<ActionResponse<TResult>> => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          data: null,
          error: {
            message:
              "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
            code: "CONFIG_ERROR",
          },
        };
      }

      const cookieStore = await cookies();

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // `cookies().set()` throws when called from a Server Component.
              // In that context we only need read access — the middleware
              // handles token refresh.
            }
          },
        },
      });

      const data = await fn(supabase, ...args);

      return { data, error: null };
    } catch (caught: unknown) {
      const error: SupaError = handleSupaError(caught);
      return { data: null, error };
    }
  };
}
