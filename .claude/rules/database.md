---
paths:
  - "packages/db/**"
---

# Database rules

- After editing `src/schema.ts`: `pnpm db:generate` (needs a TTY when it asks about renames; see docs/project-memory.md), then migrate both local DBs (`unread`, `unread_test`). Prefer additive migrations; nothing is deployed to Tiger yet, but treat migrations 0000+ as shipped.
- Custom SQL migrations exist: 0000 enables pgvector, 0002 makes `listening_events` a Timescale hypertable only when the extension exists.
- `listening_events` has no foreign keys (hypertable); account deletion removes its rows explicitly.
- Uniqueness that the app relies on: inbound `(user_id, message_id)`, scheduled `episode_requests (user_id, date)`, `billing_events.id`, promo `(code_id, user_id)`, case-insensitive codes/senders/topics.
