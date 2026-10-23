# Unread

Your unread pile as a daily podcast. Spec: `docs/prd-unread.md`. UI reference: `docs/design/` (phone canvases; desktop rules in PRD §8). Decisions: `docs/decisions/`.

## Layout
- `apps/web`: Next.js 16 App Router (UI + route handlers). Auth0 via `src/proxy.ts`.
- `packages/db`: Drizzle schema, migrations, `createDb`, id helpers.
- `apps/worker`: Temporal worker (from U1).

## Commands
- `pnpm dev` / `pnpm build`
- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `pnpm db:generate` (after schema edits), `pnpm db:migrate` (needs `DATABASE_URL`)

## Code standards
- Strict TypeScript, no `any`. Validate with Zod at every boundary (env, session, request bodies, model output, webhooks).
- Kebab-case file names. Feature folders under `apps/web/src/features/<feature>`; shadcn primitives in `src/components/ui`.
- Functions with 3+ parameters take an options object.
- Server-only modules import `server-only`. Check the session in pages and route handlers with `requireUser()`, not only in the proxy.
- Auth links (`/auth/*`) are plain `<a>`, never prefetched `<Link>`.
- Use the design tokens in `src/app/globals.css` (`bg-surface`, `border-line`, `text-muted-foreground`, `bg-brand`, …), never raw hex.
- Touch targets ≥ 44 px, `aria-label` on icon buttons, contrast ≥ 4.5:1.
- Record every third-party choice in `docs/decisions/`.
