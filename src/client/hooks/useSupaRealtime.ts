"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel } from "@supabase/supabase-js";

import type { RealtimeEvent, RealtimePayload } from "../../types";
import { useSupaConfig } from "../SupaProvider";

/**
 * React hook that subscribes to Supabase Realtime postgres_changes
 * events and **safely cleans up** on unmount to prevent memory leaks.
 *
 * @param table    - The database table to listen to.
 * @param event    - The event type: `"INSERT"`, `"UPDATE"`, `"DELETE"`, or `"*"` for all.
 * @param callback - Function called with the realtime payload on each event.
 * @param schema   - The database schema (defaults to `"public"`).
 *
 * @example
 * ```tsx
 * "use client";
 * import { useSupaRealtime } from "next-supa-utils/client";
 *
 * export default function LiveMessages() {
 *   const [messages, setMessages] = useState<Message[]>([]);
 *
 *   useSupaRealtime("messages", "INSERT", (payload) => {
 *     setMessages((prev) => [...prev, payload.new as Message]);
 *   });
 *
 *   return <ul>{messages.map((m) => <li key={m.id}>{m.text}</li>)}</ul>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Listen to all events with a custom schema
 * useSupaRealtime("orders", "*", (payload) => {
 *   console.log(payload.eventType, payload.new, payload.old);
 * }, "inventory");
 * ```
 */
export function useSupaRealtime<T extends Record<string, unknown> = Record<string, unknown>>(
  table: string,
  event: RealtimeEvent,
  callback: (payload: RealtimePayload<T>) => void,
  schema: string = "public",
): void {
  // Store callback in a ref so the channel doesn't need to re-subscribe
  // when only the callback identity changes (common with inline arrows).
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Store the channel so we can clean it up.
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Get config from Context or Environment
  const { url: supabaseUrl, key: supabaseAnonKey } = useSupaConfig();

  useEffect(() => {
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    // Generate a unique channel name to avoid collisions.
    const channelName = `realtime:${schema}:${table}:${event}:${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as "postgres_changes",
        {
          event: event === "*" ? "*" : event,
          schema,
          table,
        },
        (payload) => {
          callbackRef.current(payload as unknown as RealtimePayload<T>);
        },
      )
      .subscribe();

    channelRef.current = channel;

    // ── Cleanup: remove the channel on unmount or dep change ──────
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, event, schema]); // Re-subscribe when table/event/schema changes
}
