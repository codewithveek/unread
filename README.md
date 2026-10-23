# Unread

Every morning, Unread turns the latest stories on your topics, plus the links and newsletters you saved, into one short podcast episode, delivered to the app you already use.

- Product spec: [docs/prd-unread.md](docs/prd-unread.md)
- Design reference: [docs/design/](docs/design/README.md)
- Decisions: [docs/decisions/](docs/decisions/README.md)

## Status

| Milestone | State |
|---|---|
| U0 · Repo, Next.js, Drizzle schema, Auth0 sign-in, design tokens | Done |
| U1 · Pipeline steps 1–6 + `pnpm brief` CLI | Next |

## Run locally

Requires Node 22 and pnpm 10, plus Postgres 16 with pgvector (Tiger Data in production).

```sh
pnpm install
cp .env.example apps/web/.env.local   # fill in Auth0 + DATABASE_URL
DATABASE_URL=… pnpm db:migrate
pnpm dev                              # http://localhost:3000
```

The Auth0 tenant setup is in [docs/decisions/0002-auth0-sign-in.md](docs/decisions/0002-auth0-sign-in.md).

Note: a `DATABASE_URL` already set in your shell takes precedence over `.env.local`.

## Checks

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
