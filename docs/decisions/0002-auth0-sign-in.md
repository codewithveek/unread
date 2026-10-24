# 0002 · Auth0 sign-in

**Status:** Accepted (U0, 2026-10-23)

## Decision
- **`@auth0/nextjs-auth0` v4.33**. `src/lib/auth0.ts` creates one `Auth0Client`, and `src/proxy.ts` calls `auth0.middleware()`, which mounts `/auth/login`, `/auth/logout`, `/auth/callback`, … and keeps the rolling session alive. This is the Next 16 setup the SDK README recommends.
- **Sessions are stateless** encrypted cookies (`__session`, key `AUTH0_SECRET`); there is no session table.
- **Pages check the session themselves** (PRD §9). `requireUser()` in `features/users/current-user.ts` reads the session, validates `session.user` with Zod, and redirects to `/auth/login?returnTo=…` if there is none. It is wrapped in React `cache()`, so it runs once per request.
- **The user row is created lazily** on the first signed-in request, with a 192-bit feed token and a 10-character inbound alias. The insert uses `ON CONFLICT DO NOTHING` on `auth0_sub`, so concurrent first requests are safe.
- **Auth links are plain `<a>`**, never `<Link prefetch>`, so a prefetch can't start a login transaction.

## Auth0 tenant setup
1. Create a **Regular Web Application**.
2. Allowed Callback URLs: `http://localhost:3000/auth/callback, https://getunread.site/auth/callback`.
3. Allowed Logout URLs: `http://localhost:3000, https://getunread.site`.
4. Connections: Username-Password and Google (Universal Login).
5. Put the domain, client id and secret, `AUTH0_SECRET` (`openssl rand -hex 32`) and `APP_BASE_URL` in `.env.local`.

## Later
Token Vault for Gmail newsletters (P1 stretch) uses the same client with a connected-account flow, added only if that stretch is built.
