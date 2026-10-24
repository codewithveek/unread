import type { EpisodeTranscript } from "../episodes/transcript";

export interface FeedEpisode {
  id: string;
  title: string;
  createdAt: Date;
  durationS: number;
  audioBytes: number;
  transcript: EpisodeTranscript;
}

export interface FeedInput {
  baseUrl: string;
  feedToken: string;
  /** Shown as the podcast title, e.g. "Unread · Lucky". Never an email address (prd §7). */
  ownerLabel: string;
  episodes: FeedEpisode[];
}

function xml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
}

function cdata(html: string): string {
  return `<![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** Show notes: chapter list with times, then every source with its link (P2). */
export function showNotesHtml(transcript: EpisodeTranscript): string {
  const chapters = transcript.chapters
    .map((c) => {
      const sources = c.sources
        .map((s) => (s.url ? `<a href="${xml(s.url)}">${xml(s.label)}: ${xml(s.title)}</a>` : `${xml(s.label)}: ${xml(s.title)}`))
        .join("<br>");
      return `<p><b>${clock(c.startS)} ${xml(c.title)}</b><br>${sources}</p>`;
    })
    .join("");
  return `<p>Your newsletters, minus the overlap. Sources for every story:</p>${chapters}<p>Made by Unread · getunread.site</p>`;
}

export const feedUrls = {
  feed: (base: string, token: string) => `${base}/feed/${token}.xml`,
  audio: (base: string, token: string, id: string) => `${base}/audio/${token}/${id}.mp3`,
  cover: (base: string, token: string, id: string) => `${base}/feed/${token}/cover/${id}.png`,
  chapters: (base: string, token: string, id: string) => `${base}/feed/${token}/chapters/${id}.json`,
};

/**
 * Private RSS 2.0 feed with iTunes and Podcasting 2.0 tags (prd §7, v1 §7):
 * itunes:block, not explicit, last 30 episodes, chapters JSON per episode.
 */
export function buildFeedXml(input: FeedInput): string {
  const base = input.baseUrl.replace(/\/$/, "");
  const items = input.episodes
    .slice(0, 30)
    .map(
      (e) => `    <item>
      <title>${xml(e.title)}</title>
      <guid isPermaLink="false">unread-${e.id}</guid>
      <pubDate>${e.createdAt.toUTCString()}</pubDate>
      <description>${cdata(showNotesHtml(e.transcript))}</description>
      <content:encoded>${cdata(showNotesHtml(e.transcript))}</content:encoded>
      <enclosure url="${xml(feedUrls.audio(base, input.feedToken, e.id))}" length="${e.audioBytes}" type="audio/mpeg"/>
      <itunes:duration>${Math.round(e.durationS)}</itunes:duration>
      <itunes:image href="${xml(feedUrls.cover(base, input.feedToken, e.id))}"/>
      <itunes:explicit>false</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
      <podcast:chapters url="${xml(feedUrls.chapters(base, input.feedToken, e.id))}" type="application/json+chapters"/>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(input.ownerLabel)}</title>
    <link>${xml(base)}</link>
    <atom:link href="${xml(feedUrls.feed(base, input.feedToken))}" rel="self" type="application/rss+xml"/>
    <description>Your newsletters, minus the overlap. A private feed made by Unread.</description>
    <language>en</language>
    <itunes:author>Unread</itunes:author>
    <itunes:image href="${xml(`${base}/podcast-cover.png`)}"/>
    <itunes:category text="News"/>
    <itunes:explicit>false</itunes:explicit>
    <itunes:block>yes</itunes:block>
    <itunes:type>episodic</itunes:type>
    <podcast:locked>yes</podcast:locked>
${items}
  </channel>
</rss>
`;
}

/** Podcasting 2.0 JSON chapters. */
export function chaptersJson(transcript: EpisodeTranscript): string {
  return JSON.stringify({
    version: "1.2.0",
    chapters: [
      { startTime: 0, title: "Intro" },
      ...transcript.chapters.map((c) => ({
        startTime: Math.round(c.startS * 10) / 10,
        endTime: Math.round(c.endS * 10) / 10,
        title: c.title,
        ...(c.sources[0]?.url ? { url: c.sources[0].url } : {}),
      })),
    ],
  });
}
