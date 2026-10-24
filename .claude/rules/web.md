---
paths:
  - "apps/web/**"
---

# Web app rules (apps/web)

- Pages and route handlers check the session themselves: `requireUser()` in pages/actions, `currentUser()` (returns null) in JSON route handlers. Webhooks (`/inbound/email`, `/billing/webhooks/bachs`) verify signatures instead; feed/audio/cover routes authorise by feed token.
- Mutations are server actions in `features/<feature>/actions.ts` ("use server"), validated with Zod, returning `ActionState` for `useActionState`; call `revalidatePath` after writes.
- Import narrow core subpaths only: `@unread/core/episodes/requests`, `@unread/core/episodes/transcript`, `@unread/core/voice/voices`, `@unread/core/voice/elevenlabs`. Never `@unread/core/episodes` or `@unread/core/voice` barrels (they pull the cover renderer, Kokoro, ONNX and ffmpeg code, which breaks `next build`).
- Browser-only values (timezone, locale) use `useBrowserValue` (useSyncExternalStore), never setState inside an effect (lint error).
- The audio element lives once in `PlayerProvider` (AppShell). Never put side effects inside React state updaters (load() bug: play() ran before src was set).
- Plan limits are enforced on the server (`applyPlanLimits`, `planContextFor`), not only in the UI.
- Escape apostrophes in JSX text (`&apos;`), use design tokens, ≥ 44 px targets.
