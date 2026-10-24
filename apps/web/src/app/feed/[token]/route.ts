import { buildFeedXml } from "@unread/core/feed";
import { PRIVATE_HEADERS, readyEpisodes, userByFeedToken } from "@/features/feed/feed-data";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/** GET /feed/:feedToken.xml — the private podcast feed (prd §7). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: file } = await params;
  const token = file.endsWith(".xml") ? file.slice(0, -4) : "";
  const user = await userByFeedToken(token);
  if (!user) return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
  const episodes = await readyEpisodes(user.id);
  const xml = buildFeedXml({
    baseUrl: serverEnv().APP_BASE_URL,
    feedToken: token,
    ownerLabel: "Unread",
    episodes: episodes.map((e) => ({
      id: e.id,
      title: e.title ?? "Unread",
      createdAt: e.createdAt,
      durationS: e.durationS ?? 0,
      audioBytes: e.audioBytes ?? 0,
      transcript: e.transcript,
    })),
  });
  return new Response(xml, {
    headers: { ...PRIVATE_HEADERS, "content-type": "application/rss+xml; charset=utf-8", "cache-control": "private, max-age=300" },
  });
}
