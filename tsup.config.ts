import { defineConfig } from "tsup";

export default defineConfig([
  // ── Client entry (needs "use client" banner) ──────────────────────
  {
    entry: { "client/index": "src/client/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: [
      "react",
      "react-dom",
      "next",
      "@supabase/supabase-js",
      "@supabase/ssr",
    ],
    banner: {
      js: '"use client";',
    },
  },

  // ── Server entry ──────────────────────────────────────────────────
  {
    entry: { "server/index": "src/server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: [
      "react",
      "react-dom",
      "next",
      "next/server",
      "next/headers",
      "@supabase/supabase-js",
      "@supabase/ssr",
    ],
  },

  // ── Shared entry (types + utils) ─────────────────────────────────
  {
    entry: { "shared/index": "src/shared/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true, // only the first build cleans dist/
    external: [
      "@supabase/supabase-js",
      "@supabase/ssr",
    ],
  },
]);
