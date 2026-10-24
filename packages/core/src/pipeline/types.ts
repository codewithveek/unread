import { z } from "zod";

export type Priority = "always" | "normal" | "if_room";

/** One item that could go into an episode (prd §6 step 1). */
export interface Candidate {
  id: string;
  sourceKind: "newsletter" | "link" | "news" | "rss";
  title: string;
  text: string;
  url: string | null;
  links: { text: string; url: string }[];
  newsletterId: string | null;
  /** "Morning Brew", "Your link · example.org", "News · AI". */
  sourceLabel: string;
  priority: Priority;
  topicLabel: string | null;
  publishedAt: Date | null;
  limited: boolean;
  embedding: number[] | null;
}

/** The same story across newsletters/links, merged (P3). */
export interface Cluster {
  key: string;
  items: Candidate[];
  priority: Priority;
}

export interface PlannedChapter {
  clusterKey: string;
  targetChars: number;
}

export interface EpisodePlan {
  chapters: PlannedChapter[];
  maxChars: number;
}

export const scriptLineSchema = z.object({
  text: z.string().trim().min(1).max(400),
  sourceIds: z.array(z.string()).min(1),
});

export const chapterDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  lines: z.array(scriptLineSchema).min(1).max(40),
});

export type ChapterDraft = z.infer<typeof chapterDraftSchema>;

export interface ScriptLine {
  text: string;
  /** Item ids. Empty only for intro/outro lines. */
  sourceIds: string[];
}

export interface ScriptChapter {
  clusterKey: string;
  title: string;
  /** "Morning Brew · also in The Hustle" */
  origin: string;
  lines: ScriptLine[];
  sources: { itemId: string; label: string; title: string; url: string | null; role: "primary" | "also" }[];
}

export interface EpisodeScript {
  title: string;
  intro: ScriptLine[];
  chapters: ScriptChapter[];
  outro: ScriptLine[];
}

export function scriptCharacters(script: EpisodeScript): number {
  const lines = [...script.intro, ...script.chapters.flatMap((c) => [{ text: c.title }, ...c.lines]), ...script.outro];
  return lines.reduce((sum, l) => sum + l.text.length + 1, 0);
}
