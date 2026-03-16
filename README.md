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

## 🚀 Why Use This Over Raw `@supabase/ssr`?

If you use `@supabase/ssr` directly, you have to write boilerplate for *every* environment. **next-supa-utils** eliminates this entirely:

1. **One-Line Middleware**: No more manually copying the 40-line chunking/cookie-setting logic from the Supabase docs. Just pass your routes to `withSupaAuth()`.
2. **Type-Safe Server Actions**: Stop writing `try/catch` and `cookies().getAll()` in every server action. `createAction()` handles it automatically and forces you to check for errors.
3. **Instant Client Hooks**: `useSupaUser()` and `useSupaSession()` wrap `createBrowserClient`, fetch the initial state, *and* subscribe to real-time `onAuthStateChange` events out of the box.
4. **App Router Ready**: Strictly separated entry points (`/client` and `/server`) guarantee you won't accidentally import server code into client components.

## 📦 Installation

```bash
npm install next-supa-utils
```

*Requires `react >=18`, `next >=14`, `@supabase/supabase-js ^2`, and `@supabase/ssr >=0.5`.*

### Environment Variables

Add these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## ⚡ Quick Start

### 1. Middleware (Route Protection in 1 Line)

Protect your routes and auto-refresh sessions without copying boilerplate.

```ts
// middleware.ts
import { withSupaAuth } from "next-supa-utils/server";

export default withSupaAuth({
  protectedRoutes: ["/dashboard", "/admin"],
  redirectTo: "/login",
});

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

### 2. Server Actions (No More Try/Catch)

Automatically initializes the server client with cookies and returns a type-safe `{ data, error }` object.

```ts
// app/actions.ts
"use server";
import { createAction } from "next-supa-utils/server";

export const getProfile = createAction(async (supabase, userId: string) => {
  const { data, error } = await supabase.from("profiles").select().eq("id", userId).single();
  if (error) throw error; // Handled automatically!
  return data;
});
```

```tsx
// Usage
const { data, error } = await getProfile("123");
if (error) console.error(error.message);
```

### 3. Client Components (Real-Time User State)

Get the user and listen to auth changes immediately.

```tsx
"use client";
import { useSupaUser } from "next-supa-utils/client";

export default function Avatar() {
  const { user, loading } = useSupaUser();

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Please sign in</p>;

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
