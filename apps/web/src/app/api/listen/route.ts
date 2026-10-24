import { schema } from "@unread/db";
import { rateLimit } from "@unread/core/util/rate-limit";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { currentUser } from "@/features/users/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const eventSchema = z.object({
  episodeId: z.string().length(26),
  chapterIndex: z.number().int().min(0).max(100).nullable(),
  event: z.enum(["play", "skip", "complete", "seek"]),
  positionS: z.number().min(0).max(24 * 3600),
});

/** Listening signals for ranking (prd §7: hypertable listening_events). */
export async function POST(request: Request) {
  const current = await currentUser();
  if (!current) return Response.json({ error: "Sign in" }, { status: 401 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad event" }, { status: 400 });
  if (!(await rateLimit({ db: db(), key: `listen:${current.user.id}`, limit: 600, windowSeconds: 3600 }))) {
    return new Response(null, { status: 429 });
  }
  const { episodeId, chapterIndex, event, positionS } = parsed.data;
  const [episode] = await db()
    .select({ id: schema.episodes.id })
    .from(schema.episodes)
    .where(and(eq(schema.episodes.id, episodeId), eq(schema.episodes.userId, current.user.id)));
  if (!episode) return Response.json({ error: "Not found" }, { status: 404 });
  const [chapter] =
    chapterIndex === null
      ? []
      : await db()
          .select({ id: schema.chapters.id })
          .from(schema.chapters)
          .where(and(eq(schema.chapters.episodeId, episodeId), eq(schema.chapters.position, chapterIndex)));
  await db()
    .insert(schema.listeningEvents)
    .values({ userId: current.user.id, episodeId, chapterId: chapter?.id ?? null, event, positionS, client: "web" });
  return new Response(null, { status: 204 });
}
