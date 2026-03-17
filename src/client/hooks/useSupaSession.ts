"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

import type { UseSupaSessionReturn } from "../../types";
import { handleSupaError } from "../../shared/utils/error-handler";
import { useSupaConfig } from "../SupaProvider";

/**
 * React hook that provides the current Supabase session and
 * subscribes to real-time auth state changes.
 *
 * Must be used inside a Client Component (`"use client"`).
 *
 * @example
 * ```tsx
 * "use client";
 * import { useSupaSession } from "next-supa-utils/client";
 *
 * export default function TokenDisplay() {
 *   const { session, loading, error } = useSupaSession();
 *
 *   if (loading)   return <p>Loading…</p>;
 *   if (error)     return <p>Error: {error.message}</p>;
 *   if (!session)  return <p>No active session</p>;
 *
 *   return <p>Token expires at: {session.expires_at}</p>;
 * }
 * ```
 */
export function useSupaSession(): UseSupaSessionReturn {
  const [state, setState] = useState<UseSupaSessionReturn>({
    session: null,
    loading: true,
    error: null,
  });

  // Get config from Context or Environment
  const { url: supabaseUrl, key: supabaseAnonKey } = useSupaConfig();

  useEffect(() => {
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    // ── Initial fetch ─────────────────────────────────────────────
    supabase.auth.getSession().then(({ data, error }) => {
      setState({
        session: data.session,
        loading: false,
        error: error ? handleSupaError(error) : null,
      });
    });

    // ── Subscribe to auth state changes ───────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setState((prev) => ({
        ...prev,
        session,
        loading: false,
      }));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
