"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

import type { UseSupaUserReturn } from "../../types";
import { handleSupaError } from "../../shared/utils/error-handler";

/**
 * React hook that provides the current Supabase user and
 * subscribes to real-time auth state changes.
 *
 * Must be used inside a Client Component (`"use client"`).
 *
 * @example
 * ```tsx
 * "use client";
 * import { useSupaUser } from "next-supa-utils/client";
 *
 * export default function Avatar() {
 *   const { user, loading, error } = useSupaUser();
 *
 *   if (loading) return <p>Loading…</p>;
 *   if (error)  return <p>Error: {error.message}</p>;
 *   if (!user)  return <p>Not signed in</p>;
 *
 *   return <p>Hello, {user.email}</p>;
 * }
 * ```
 */
export function useSupaUser(): UseSupaUserReturn {
  const [state, setState] = useState<UseSupaUserReturn>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setState({
        user: null,
        loading: false,
        error: {
          message:
            "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
          code: "CONFIG_ERROR",
        },
      });
      return;
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    // ── Initial fetch ─────────────────────────────────────────────
    supabase.auth.getUser().then(({ data, error }) => {
      setState({
        user: data.user,
        loading: false,
        error: error ? handleSupaError(error) : null,
      });
    });

    // ── Subscribe to auth state changes ───────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        loading: false,
      }));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
