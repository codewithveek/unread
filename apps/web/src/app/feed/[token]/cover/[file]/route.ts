import { storageKeys } from "@unread/core/storage";
import { PRIVATE_HEADERS, readyEpisode, userByFeedToken } from "@/features/feed/feed-data";
import { serveObject } from "@/features/feed/serve-object";

export const runtime = "nodejs";

/** Episode cover: 3000 px for the feed, `?size=1200` for the app. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  const user = await userByFeedToken(token);
  const episode = user && file.endsWith(".png") ? await readyEpisode(user.id, file.slice(0, -4)) : null;
  if (!user || !episode) return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
  const size = new URL(request.url).searchParams.get("size") === "1200" ? 1200 : 3000;
  return serveObject({ request, key: storageKeys.episodeCover(user.id, episode.id, size), contentType: "image/png", maxAge: 86400 });
}
