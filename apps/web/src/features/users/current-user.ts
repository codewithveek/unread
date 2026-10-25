import "server-only";
import { newFeedToken, newInboundAlias, schema, type User } from "@unread/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";

const sessionUserSchema = z.object({
  sub: z.string().min(1),
  email: z.email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export interface CurrentUser {
  user: User;
  sessionUser: SessionUser;
}

async function findOrCreateUser(sessionUser: SessionUser): Promise<User> {
  const [existing] = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.auth0Sub, sessionUser.sub))
    .limit(1);
  if (existing) return existing;

  await db()
    .insert(schema.users)
    .values({
      auth0Sub: sessionUser.sub,
      email: sessionUser.email ?? null,
      feedToken: newFeedToken(),
      inboundAlias: newInboundAlias(),
    })
    .onConflictDoNothing({ target: schema.users.auth0Sub });

  const [created] = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.auth0Sub, sessionUser.sub))
    .limit(1);
  if (!created) throw new Error("Could not create user row");
  return created;
}

/**
 * Auth0 has verified this address, so it may forward newsletters (prd §4.1).
 * Runs on every session, not only at sign-up: email/password users verify
 * after their row exists, and the address may already be pending in Sources.
 */
async function trustSignInEmail(user: User, sessionUser: SessionUser): Promise<void> {
  if (!sessionUser.email || !sessionUser.email_verified) return;
  const email = sessionUser.email.toLowerCase();
  await db()
    .update(schema.verifiedSenders)
    .set({ verifiedAt: new Date(), verificationCode: null })
    .where(
      and(
        eq(schema.verifiedSenders.userId, user.id),
        sql`lower(${schema.verifiedSenders.email}) = ${email}`,
        isNull(schema.verifiedSenders.verifiedAt),
      ),
    );
  await db().insert(schema.verifiedSenders).values({ userId: user.id, email, verifiedAt: new Date() }).onConflictDoNothing();
}

async function loadUser(sessionUser: SessionUser): Promise<User> {
  const user = await findOrCreateUser(sessionUser);
  await trustSignInEmail(user, sessionUser);
  return user;
}

/**
 * The signed-in user, creating their row on first visit. Redirects to
 * Universal Login when there is no session. Memoised per request.
 */
export const requireUser = cache(async (returnTo: string = "/today"): Promise<CurrentUser> => {
  const session = await auth0.getSession();
  if (!session) {
    // /auth/* is mounted by the Auth0 proxy, so typed routes cannot see it.
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}` as Route);
  }
  const sessionUser = sessionUserSchema.parse(session.user);
  const user = await loadUser(sessionUser);
  return { user, sessionUser };
});

/** For route handlers: the signed-in user or null (no redirect). */
export async function currentUser(): Promise<CurrentUser | null> {
  const session = await auth0.getSession();
  if (!session) return null;
  const sessionUser = sessionUserSchema.parse(session.user);
  return { user: await loadUser(sessionUser), sessionUser };
}
