<p align="center">
  <h1 align="center">next-supa-utils</h1>
  <p align="center">
    Eliminate Supabase boilerplate in Next.js App Router.<br/>
    Hooks, middleware helpers, and server action wrappers — all type-safe.
  </p>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## Why?

Every Next.js + Supabase project ends up with the same boilerplate:

- Creating Supabase clients with cookie handling for middleware, server components, and client components
- Writing try/catch wrappers around every server action
- Manually checking auth state in middleware and redirecting

**next-supa-utils** extracts these patterns into a single, type-safe library with separate entry points for client and server code — fully compatible with the Next.js App Router architecture.

## Features

- 🔐 **`withSupaAuth`** — Drop-in middleware for route protection with redirect support
- ⚡ **`createAction`** — Higher-order function that wraps server actions with automatic Supabase client creation and error handling
- 👤 **`useSupaUser`** — React hook for real-time user state with auth change subscriptions
- 🔑 **`useSupaSession`** — React hook for real-time session state
- 🧩 **Separate entry points** — `next-supa-utils/client` and `next-supa-utils/server` to respect the `"use client"` boundary
- 📦 **Dual format** — Ships ESM and CJS with full TypeScript declarations

## Installation

```bash
npm install next-supa-utils
```

### Peer Dependencies

Make sure you have the following installed in your project:

```bash
npm install react next @supabase/supabase-js @supabase/ssr
```

| Package | Version |
|---|---|
| `react` | `>=18` |
| `next` | `>=14` |
| `@supabase/supabase-js` | `^2.0.0` |
| `@supabase/ssr` | `>=0.5.0` |

## Environment Variables

Add these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both variables are required. All helpers in this library read from these environment variables automatically.

---

## Quick Start

### 1. Protect Routes with Middleware

```ts
// middleware.ts
import { withSupaAuth } from "next-supa-utils/server";

export default withSupaAuth({
  protectedRoutes: ["/dashboard", "/admin", "/settings"],
  redirectTo: "/login",
  publicRoutes: ["/admin/login"],
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 2. Create Type-Safe Server Actions

```ts
// app/actions/profile.ts
"use server";
import { createAction } from "next-supa-utils/server";

export const getProfile = createAction(async (supabase, userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
});
```

```tsx
// Usage in any component
const result = await getProfile("user-uuid");

if (result.error) {
  console.error(result.error.message);
} else {
  console.log(result.data);
}
```

### 3. Use Auth State in Client Components

```tsx
"use client";
import { useSupaUser } from "next-supa-utils/client";

export default function Avatar() {
  const { user, loading, error } = useSupaUser();

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!user) return <p>Not signed in</p>;

  return <p>Hello, {user.email}!</p>;
}
```

---

## API Reference

### Server — `next-supa-utils/server`

#### `withSupaAuth(config)`

Creates a Next.js middleware function that handles session refresh and route protection.

**Parameters:**

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `protectedRoutes` | `string[]` | ✅ | — | Route prefixes that require authentication |
| `redirectTo` | `string` | — | `"/login"` | Where to redirect unauthenticated users |
| `publicRoutes` | `string[]` | — | `[]` | Routes that are always public, even if matching a protected prefix |
| `onAuthSuccess` | `(user: { id: string; email?: string }) => void \| Promise<void>` | — | — | Optional callback after successful auth verification |

**Returns:** `(request: NextRequest) => Promise<NextResponse>`

**Behavior:**
1. Creates a Supabase server client with proper cookie forwarding
2. Calls `supabase.auth.getUser()` to refresh the session
3. If the current path matches `publicRoutes`, allows access immediately
4. If the current path matches `protectedRoutes` and the user is not authenticated, redirects to `redirectTo` with a `?next=<original_path>` query parameter
5. Calls `onAuthSuccess` if the user is authenticated and the callback is provided

---

#### `createAction(fn)`

Wraps an async function into a server action with automatic Supabase client initialization and error handling.

**Signature:**

```ts
function createAction<TArgs extends unknown[], TResult>(
  fn: (supabase: SupabaseClient, ...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<ActionResponse<TResult>>
```

**Returns:** `ActionResponse<TResult>` — a discriminated union:

```ts
// On success:
{ data: TResult; error: null }

// On failure:
{ data: null; error: SupaError }
```

**Behavior:**
1. Creates a Supabase server client using `cookies()` from `next/headers`
2. Passes the client as the first argument to your function
3. Wraps execution in try/catch — any thrown error is normalized into a `SupaError`

---

### Client — `next-supa-utils/client`

> ⚠️ All client exports include the `"use client"` directive. They must be used inside Client Components only.

#### `useSupaUser()`

React hook that provides the current authenticated user and subscribes to auth state changes.

**Returns:** `UseSupaUserReturn`

| Property | Type | Description |
|---|---|---|
| `user` | `User \| null` | The current Supabase user object, or `null` if not authenticated |
| `loading` | `boolean` | `true` while the initial fetch is in progress |
| `error` | `SupaError \| null` | Error details if the fetch failed |

**Behavior:**
1. Creates a browser client via `createBrowserClient` from `@supabase/ssr`
2. Calls `supabase.auth.getUser()` on mount
3. Subscribes to `onAuthStateChange` for real-time updates (sign in, sign out, token refresh)
4. Cleans up the subscription on unmount

---

#### `useSupaSession()`

React hook that provides the current session (access token, refresh token, expiry) and subscribes to auth state changes.

**Returns:** `UseSupaSessionReturn`

| Property | Type | Description |
|---|---|---|
| `session` | `Session \| null` | The current Supabase session, or `null` if not authenticated |
| `loading` | `boolean` | `true` while the initial fetch is in progress |
| `error` | `SupaError \| null` | Error details if the fetch failed |

---

### Shared — `next-supa-utils`

#### `handleSupaError(error)`

Normalizes any thrown value into a consistent `SupaError` shape. Used internally by `createAction` and the hooks, but also exported for direct use.

```ts
function handleSupaError(error: unknown): SupaError
```

**Handles:**
- Supabase `AuthError` / `PostgrestError` (extracts `message`, `code`, `status`)
- Standard `Error` instances
- Plain objects with a `message` property
- Strings
- Unknown values (fallback: `"An unknown error occurred"`)

---

### Types

```ts
interface SupaError {
  message: string;
  code?: string;
  status?: number;
}

type ActionResponse<T> =
  | { data: T; error: null }
  | { data: null; error: SupaError };

interface SupaAuthConfig {
  protectedRoutes: string[];
  redirectTo?: string;
  publicRoutes?: string[];
  onAuthSuccess?: (user: { id: string; email?: string }) => void | Promise<void>;
}
```

---

## Project Structure

```
src/
├── client/              # "use client" — browser-only code
│   ├── hooks/
│   │   ├── useSupaUser.ts
│   │   └── useSupaSession.ts
│   └── index.ts
├── server/              # Server-only (Node/Edge runtime)
│   ├── middleware/
│   │   └── withSupaAuth.ts
│   ├── actions/
│   │   └── actionWrapper.ts
│   └── index.ts
├── shared/              # Isomorphic utilities
│   ├── utils/
│   │   └── error-handler.ts
│   └── index.ts
└── types/
    └── index.ts
```

## Import Paths

| Import | Environment | Contains |
|---|---|---|
| `next-supa-utils/client` | Client Components | `useSupaUser`, `useSupaSession` |
| `next-supa-utils/server` | Server Components, Middleware, Server Actions | `withSupaAuth`, `createAction` |
| `next-supa-utils` | Anywhere | `handleSupaError`, all types |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`npm install`)
4. Make your changes
5. Run the type checker (`npm run typecheck`)
6. Build the project (`npm run build`)
7. Commit your changes (`git commit -m 'feat: add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## License

[MIT](LICENSE)
