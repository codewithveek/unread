import { generateStructured, type ModelClient } from "../model";
import { chapterDraftSchema, type Cluster, type EpisodePlan, type EpisodeScript, type ScriptChapter, type ScriptLine } from "./types";

const SOURCE_CHARS = 3_500;

export const WRITER_SYSTEM = `You write one chapter of Unread, a short spoken podcast that summarises the listener's newsletters.
Rules:
- Spoken, plain English, warm and direct. Short sentences. No headings, lists, emoji or markdown.
- Summarise in your own words. Never copy a sentence from a source.
- Only state facts, numbers, names and quotes that appear in the sources. If unsure, leave it out.
- Every line lists the ids of the sources it relies on, e.g. ["S1"].
- At most 30 words per line.
- If several sources cover the story, say so once, e.g. "Morning Brew and The Hustle both covered this."
- Don't greet the listener or sign off; the episode has its own intro and outro.
- The title is a short headline in your own words: no reading times, "Sponsored", emoji or source names.`;

const CLUTTER = [
  // "(6 minute read)", "[5 min]", "(3-min listen)"
  /\s*[([]\s*\d+\s*[-\s]?(?:minutes?|mins?)\.?(?:\s+(?:read|listen|watch))?\s*[)\]]/gi,
  // "(Sponsored)", "[Ad]"
  /\s*[([]\s*(?:sponsored|sponsor|ad|partner|paid)\s*[)\]]/gi,
  // "Sponsored: …", "Together with Acme — …"
  /^\s*(?:sponsored|together with [^:—|-]+)\s*[:|—-]\s*/i,
  // "… | 4 min read"
  /\s*[|·—-]\s*\d+\s*(?:minutes?|mins?)\s+read\s*$/i,
];

/** Newsletter headline clutter ("(6 minute read)", "(Sponsored)") that shouldn't be read aloud or shown. */
export function cleanHeadline(title: string): string {
  const cleaned = CLUTTER.reduce((t, pattern) => t.replace(pattern, ""), title).replace(/\s{2,}/g, " ").trim();
  return cleaned || title.trim();
}

function sourceBlock(cluster: Cluster): { text: string; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const text = cluster.items
    .map((item, i) => {
      const sid = `S${i + 1}`;
      idMap.set(sid, item.id);
      const body = item.limited ? `${item.text}\n(Only a snippet was available; stick to it.)` : item.text;
      return `[${sid}] ${item.sourceLabel} — "${item.title}"\n${body.slice(0, SOURCE_CHARS)}`;
    })
    .join("\n\n");
  return { text, idMap };
}

export function originLabel(cluster: Cluster): string {
  const labels = [...new Set(cluster.items.map((i) => i.sourceLabel))];
  return labels.length > 1 ? `${labels[0]} · also in ${labels.slice(1).join(", ")}` : (labels[0] ?? "");
}

/** Step 5, one chapter: Gemma drafts JSON lines that cite S-ids, mapped back to item ids. */
export async function writeChapter(options: {
  model: ModelClient;
  cluster: Cluster;
  targetChars: number;
}): Promise<ScriptChapter> {
  const { model, cluster, targetChars } = options;
  const { text, idMap } = sourceBlock(cluster);
  const draft = await generateStructured({
    client: model,
    system: WRITER_SYSTEM,
    prompt: `Sources:\n${text}\n\nWrite this chapter in about ${targetChars} characters of spoken text (roughly ${Math.max(
      1,
      Math.round((targetChars / 900) * 60),
    )} seconds).\nReturn {"title": "short chapter title", "lines": [{"text": "...", "sourceIds": ["S1"]}]}.`,
    schema: chapterDraftSchema,
    validate: (d) => {
      const chars = d.lines.reduce((s, l) => s + l.text.length, 0);
      if (chars > targetChars * 1.35) return `Too long: ${chars} characters, aim for ${targetChars}`;
      const bad = d.lines.flatMap((l) => l.sourceIds).filter((id) => !idMap.has(id));
      return bad.length ? `Unknown source ids: ${bad.join(", ")}` : null;
    },
    temperature: 0.5,
    maxTokens: 2_000,
  });
  return {
    clusterKey: cluster.key,
    title: cleanHeadline(draft.title),
    origin: originLabel(cluster),
    lines: draft.lines.map((l) => ({ text: l.text, sourceIds: l.sourceIds.map((s) => idMap.get(s) ?? s) })),
    sources: cluster.items.map((item, i) => ({
      itemId: item.id,
      label: item.sourceLabel,
      title: cleanHeadline(item.title),
      url: item.url ?? item.links[0]?.url ?? null,
      role: i === 0 ? ("primary" as const) : ("also" as const),
    })),
  };
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Intro and outro are templates, so they can't hallucinate (prd §6 step 5: intro names the newsletters). */
export function introAndOutro(options: { clusters: Cluster[]; dateLabel: string; storyCount: number }): {
  intro: ScriptLine[];
  outro: ScriptLine[];
  title: string;
} {
  const names = [
    ...new Set(
      options.clusters.flatMap((c) => c.items.map((i) => (i.sourceKind === "newsletter" ? i.sourceLabel : i.sourceKind === "news" ? "the news" : "your saved links"))),
    ),
  ];
  const shown = names.slice(0, 4);
  const more = names.length > shown.length ? ` and ${names.length - shown.length} more` : "";
  const stories = `${options.storyCount} ${options.storyCount === 1 ? "story" : "stories"}`;
  return {
    title: `${options.dateLabel}: ${stories} from ${listNames(shown)}${more}`,
    intro: [
      { text: `This is Unread for ${options.dateLabel}.`, sourceIds: [] },
      { text: `${stories[0]?.toUpperCase()}${stories.slice(1)} today, from ${listNames(shown)}${more}.`, sourceIds: [] },
    ],
    outro: [{ text: "That's everything for now. Every story's sources are in the show notes. See you next time.", sourceIds: [] }],
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index] as T);
      }
    }),
  );
  return results;
}

/** Step 5: all chapters (in parallel, a few at a time) plus the templated intro/outro. */
export async function writeScript(options: {
  model: ModelClient;
  plan: EpisodePlan;
  clusters: Cluster[];
  dateLabel: string;
  concurrency?: number;
}): Promise<EpisodeScript> {
  const byKey = new Map(options.clusters.map((c) => [c.key, c]));
  const planned = options.plan.chapters.flatMap((p) => {
    const cluster = byKey.get(p.clusterKey);
    return cluster ? [{ cluster, targetChars: p.targetChars }] : [];
  });
  const settled = await mapLimit(planned, options.concurrency ?? 3, async (p) => {
    try {
      return await writeChapter({ model: options.model, ...p });
    } catch {
      return null; // a story Gemma couldn't write cleanly is left out, never padded
    }
  });
  const chapters = settled.filter((c): c is ScriptChapter => c !== null);
  const used = chapters.map((c) => byKey.get(c.clusterKey)).filter((c): c is Cluster => Boolean(c));
  const { intro, outro, title } = introAndOutro({ clusters: used, dateLabel: options.dateLabel, storyCount: chapters.length });
  return { title, intro, chapters, outro };
}
