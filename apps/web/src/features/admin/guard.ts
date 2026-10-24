import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/users/current-user";
import { serverEnv } from "@/lib/env";

/** Admins are listed in ADMIN_EMAILS and must have a verified email. Others get a 404. */
export async function requireAdmin() {
  const current = await requireUser("/admin");
  const email = current.sessionUser.email?.toLowerCase();
  if (!email || !current.sessionUser.email_verified || !serverEnv().ADMIN_EMAILS.includes(email)) notFound();
  return current;
}
