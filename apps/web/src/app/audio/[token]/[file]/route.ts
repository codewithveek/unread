import { PRIVATE_HEADERS, readyEpisode, userByFeedToken } from "@/features/feed/feed-data";
import { serveObject } from "@/features/feed/serve-object";

export const runtime = "nodejs";

/** Enclosure URL: /audio/:feedToken/:episodeId.mp3. Rotating the feed token revokes it (prd §10). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  const user = await userByFeedToken(token);
  const episode = user && file.endsWith(".mp3") ? await readyEpisode(user.id, file.slice(0, -4)) : null;
  if (!episode?.audioKey) return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
  return serveObject({ request, key: episode.audioKey, contentType: "audio/mpeg", maxAge: 86400 });
}
