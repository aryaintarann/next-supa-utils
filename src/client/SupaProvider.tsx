"use client";

import React, { createContext, useContext, ReactNode } from "react";

export interface SupaContextValue {
  /**
   * Explicit Supabase Project URL.
   * If omitted, the context falls back to `process.env.NEXT_PUBLIC_SUPABASE_URL`.
   */
  supabaseUrl?: string;

  /**
   * Explicit Supabase Anon Key.
   * If omitted, the context falls back to `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   */
  supabaseAnonKey?: string;
}

const SupaContext = createContext<SupaContextValue | undefined>(undefined);

/**
 * `<SupaProvider>` allows you to inject explicit Supabase credentials
 * (URL and Anon Key) into all `next-supa-utils/client` hooks.
 *
 * It is completely **optional** if you are using the standard environment
 * variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { SupaProvider } from "next-supa-utils/client";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SupaProvider supabaseUrl="https://..." supabaseAnonKey="ey...">
 *           {children}
 *         </SupaProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function SupaProvider({
  children,
  supabaseUrl,
  supabaseAnonKey,
}: { children: ReactNode } & SupaContextValue) {
  return (
    <SupaContext.Provider value={{ supabaseUrl, supabaseAnonKey }}>
      {children}
    </SupaContext.Provider>
  );
}

/**
 * Internal hook to retrieve the Supabase configuration from Context or Environment Variables.
 */
export function useSupaConfig() {
  const context = useContext(SupaContext);

  const url = context?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = context?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[next-supa-utils] Missing Supabase configuration. Provide NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables, or wrap your tree in <SupaProvider supabaseUrl={...} supabaseAnonKey={...}>.",
    );
  }

  return { url, key };
}
