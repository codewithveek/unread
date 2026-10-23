# 0001 · Monorepo and web stack

**Status:** Accepted (U0, 2026-10-23)

## Context
The PRD (§4) has a Next.js web app and a separate Temporal worker that share the database schema.

## Decision
- **pnpm workspaces** (`pnpm@10.28`): `apps/web` (Next.js) and `packages/db` (Drizzle schema and client). `apps/worker` arrives in U1 and imports `@unread/db` the same way. Packages ship TypeScript source; Next compiles them through `transpilePackages`.
- **Next.js 16.4** with the App Router and Turbopack. Next 16 replaces `middleware.ts` with `proxy.ts`, which Auth0 uses (see 0002). `typedRoutes` is on.
- **TypeScript 6.0**, pinned. TypeScript 7 (the native compiler) is `latest` on npm, but we pin 6.0 until Next's build-time type check has been verified against it.
- **Tailwind CSS v4 + shadcn/ui** (`new-york`, CSS variables). The design tokens in `docs/design/README.md` are defined once in `apps/web/src/app/globals.css` under shadcn's variable names (`--background`, `--primary`, …), plus Unread aliases (`surface`, `surface-2`, `line`, `text-2`, `brand`, `link`). The app is dark-only.
- **Geist** comes from the `geist` package, so fonts are self-hosted and no Google Fonts request is made at runtime.
- **Feature folders** under `apps/web/src/features/*` (`shell`, `today`, `users`); shadcn primitives under `src/components/ui`.

## Consequences
- One layout tree serves every width: the bottom tab bar and the 240 px sidebar both render, and CSS breakpoints decide which one shows (PRD §8).
- `/auth/*` is mounted by the proxy, so typed routes can't see it; the one redirect there uses a cast.
