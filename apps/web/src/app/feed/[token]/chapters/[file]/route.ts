import { chaptersJson } from "@unread/core/feed";
import { PRIVATE_HEADERS, readyEpisode, userByFeedToken } from "@/features/feed/feed-data";

export const runtime = "nodejs";

/** Podcasting 2.0 chapters for one episode. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  const user = await userByFeedToken(token);
  const episode = user && file.endsWith(".json") ? await readyEpisode(user.id, file.slice(0, -5)) : null;
  if (!episode) return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
  return new Response(chaptersJson(episode.transcript), {
    headers: { ...PRIVATE_HEADERS, "content-type": "application/json+chapters", "cache-control": "private, max-age=86400" },
  });
}
