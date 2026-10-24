import { schema } from "@unread/db";
import { storageKeys } from "@unread/core/storage";
import { rateLimit } from "@unread/core/util/rate-limit";
import { elevenLabsClient, generateStudioPreview } from "@unread/core/voice/elevenlabs";
import { eq } from "drizzle-orm";
import { isStudioVoice } from "@/features/settings/studio-voices";
import { currentUser } from "@/features/users/current-user";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * "Upgrade to Studio voices" sample (prd §8.1): the same intro in a Studio
 * voice, generated once per voice and cached. Signed-in users, known voices,
 * rate-limited, so nobody can spend credits on arbitrary voices.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const current = await currentUser();
  if (!current) return new Response("Sign in", { status: 401 });
  const { voiceId } = await params;
  if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId) || !(await isStudioVoice(voiceId))) return new Response("Unknown voice", { status: 404 });

  const assetKey = `preview-${voiceId}`;
  const [asset] = await db().select().from(schema.audioAssets).where(eq(schema.audioAssets.key, assetKey)).limit(1);
  let bytes = asset ? await storage().get(asset.storageKey) : null;
  if (!bytes) {
    if (!(await rateLimit({ db: db(), key: `preview:${current.user.id}`, limit: 10, windowSeconds: 3600 }))) {
      return new Response("Too many previews; try again later", { status: 429 });
    }
    bytes = await generateStudioPreview(elevenLabsClient(serverEnv().ELEVENLABS_API_KEY), voiceId);
    const storageKey = storageKeys.asset(`previews/${voiceId}.mp3`);
    await storage().put(storageKey, bytes, "audio/mpeg");
    await db().insert(schema.audioAssets).values({ key: assetKey, storageKey }).onConflictDoNothing();
  }
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400", "content-length": String(bytes.byteLength) },
  });
}
