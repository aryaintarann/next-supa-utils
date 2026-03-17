"use client";

import { useCallback, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

import type { UseSupaUploadReturn, UploadOptions } from "../../types";
import { handleSupaError } from "../../shared/utils/error-handler";
import { useSupaConfig } from "../SupaProvider";

/**
 * React hook that simplifies uploading files to Supabase Storage
 * with **real-time progress tracking**.
 *
 * Uses `XMLHttpRequest` against the Supabase Storage REST API so that
 * `progress` updates smoothly from 0 → 100 as bytes are sent, without
 * requiring `tus-js-client` or any extra dependencies.
 *
 * @param bucketName - The name of the Supabase Storage bucket to upload to.
 *
 * @example
 * ```tsx
 * "use client";
 * import { useSupaUpload } from "next-supa-utils/client";
 *
 * export default function AvatarUploader() {
 *   const { upload, isUploading, progress, data, error } = useSupaUpload("avatars");
 *
 *   const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (!file) return;
 *     await upload(file, { path: `users/${file.name}`, upsert: true });
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleChange} disabled={isUploading} />
 *       {isUploading && <progress value={progress} max={100} />}
 *       {isUploading && <p>{progress}%</p>}
 *       {error && <p>Error: {error.message}</p>}
 *       {data && <p>Uploaded to: {data.path}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSupaUpload(bucketName: string): UseSupaUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState<UseSupaUploadReturn["data"]>(null);
  const [error, setError] = useState<UseSupaUploadReturn["error"]>(null);

  // Abort controller reference so we can cancel in-flight uploads.
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Stable reference to the Supabase client (used only to get the session token).
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  // Get config from Context or Environment
  const { url: supabaseUrl, key: supabaseAnonKey } = useSupaConfig();

  function getClient() {
    if (supabaseRef.current) return supabaseRef.current;
    supabaseRef.current = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return supabaseRef.current;
  }

  const upload = useCallback(
    async (file: File, options?: UploadOptions) => {
      // ── Reset state ──────────────────────────────────────────────
      setIsUploading(true);
      setProgress(0);
      setData(null);
      setError(null);

      try {
        const supabase = getClient();

        // Retrieve the current session token for authorization.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const accessToken = session?.access_token ?? supabaseAnonKey;
        const filePath = options?.path ?? file.name;

        // ── Build the Storage REST API URL ─────────────────────────
        // POST /storage/v1/object/:bucket/:path
        const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${filePath}`;

        // ── Upload via XHR for real-time progress ──────────────────
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          // ── Progress handler ───────────────────────────────────
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setProgress(pct);
            }
          });

          // ── Success handler ────────────────────────────────────
          xhr.addEventListener("load", () => {
            xhrRef.current = null;

            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText) as {
                  Key?: string;
                  Id?: string;
                };
                // Supabase returns { Key: "bucket/path" }
                const fullPath = response.Key ?? `${bucketName}/${filePath}`;
                setData({ path: filePath, fullPath });
                setProgress(100);
                resolve();
              } catch {
                // Response parsed fine even if body structure differs
                setData({ path: filePath, fullPath: `${bucketName}/${filePath}` });
                setProgress(100);
                resolve();
              }
            } else {
              // Server returned an error status
              try {
                const errBody = JSON.parse(xhr.responseText) as {
                  statusCode?: string;
                  error?: string;
                  message?: string;
                };
                reject(
                  new Error(
                    errBody.message ?? errBody.error ?? `Upload failed with status ${xhr.status}`,
                  ),
                );
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });

          // ── Error handler ──────────────────────────────────────
          xhr.addEventListener("error", () => {
            xhrRef.current = null;
            reject(new Error("Network error during upload"));
          });

          // ── Abort handler ──────────────────────────────────────
          xhr.addEventListener("abort", () => {
            xhrRef.current = null;
            reject(new Error("Upload cancelled"));
          });

          // ── Send the request ───────────────────────────────────
          xhr.open("POST", uploadUrl, true);
          xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
          xhr.setRequestHeader("apikey", supabaseAnonKey);
          xhr.setRequestHeader(
            "Content-Type",
            options?.contentType ?? (file.type || "application/octet-stream"),
          );
          xhr.setRequestHeader(
            "cache-control",
            options?.cacheControl ?? "3600",
          );
          xhr.setRequestHeader(
            "x-upsert",
            String(options?.upsert ?? false),
          );

          xhr.send(file);
        });
      } catch (caught: unknown) {
        setError(handleSupaError(caught));
        setProgress(0);
      } finally {
        setIsUploading(false);
      }
    },
    [bucketName],
  );

  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setIsUploading(false);
    setProgress(0);
    setData(null);
    setError(null);
  }, [cancel]);

  return { upload, isUploading, progress, data, error, reset, cancel };
}
