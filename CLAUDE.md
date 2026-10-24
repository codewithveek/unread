# Unread

Your newsletters as a podcast. Spec: `docs/prd-unread.md` (v2). UI reference: `docs/design/` (phone canvases; desktop rules in PRD §9). Decisions: `docs/decisions/`.

## Layout
- `apps/web`: Next.js 16 App Router (UI + route handlers). Auth0 via `src/proxy.ts`.
- `packages/db`: Drizzle schema, migrations, `createDb`, id helpers.
- `packages/core`: all domain logic, by subpath (`@unread/core/inbound`, `/pipeline`, `/episodes`, `/voice`, `/plans`, `/promo`, `/billing`, …). Web imports narrow subpaths only (never `/episodes` or `/voice` barrels: they pull ONNX/ffmpeg code).
- `apps/inbound-worker`: Cloudflare Email Worker that relays forwarded mail to `/inbound/email` (ADR 0004).
- `apps/worker`: Temporal worker or poller for the episode pipeline, plus CLIs.

## Commands
- `pnpm dev` / `pnpm build`
- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `pnpm db:generate` (after schema edits; drizzle-kit needs a TTY for rename prompts), `pnpm db:migrate` (needs `DATABASE_URL`)
- `pnpm brief --user <id>`, `pnpm make-episode --user <id>`, `pnpm worker`, `pnpm promo create|list`
- Integration tests: `TEST_DATABASE_URL=… [RUN_EMBEDDING_TESTS=1] [RUN_TEMPORAL_TESTS=1] pnpm test`

## Code standards
- Strict TypeScript, no `any`. Validate with Zod at every boundary (env, session, request bodies, model output, webhooks).
- Kebab-case file names. Feature folders under `apps/web/src/features/<feature>`; shadcn primitives in `src/components/ui`.
- Functions with 3+ parameters take an options object.
- Server-only modules import `server-only`. Check the session in pages and route handlers with `requireUser()`, not only in the proxy.
- Auth links (`/auth/*`) are plain `<a>`, never prefetched `<Link>`.
- Use the design tokens in `src/app/globals.css` (`bg-surface`, `border-line`, `text-muted-foreground`, `bg-brand`, …), never raw hex.
- Touch targets ≥ 44 px, `aria-label` on icon buttons, contrast ≥ 4.5:1.
- Record every third-party choice in `docs/decisions/`.
- The effective plan comes only from `effectivePlan()`; voice code never checks plans; plan changes only from Bachs webhooks.
- In drizzle `sql` templates, don't interpolate `Date` values (postgres-js can't serialise them there); use `lt/gt/eq` operators.
