import { z } from "zod";
import { generateStructured, type ModelClient } from "../model";
import { WRITER_SYSTEM } from "./script";
import { type EpisodeScript, type ScriptChapter, type ScriptLine, scriptCharacters, scriptLineSchema } from "./types";

export const MAX_WORDS_PER_LINE = 30;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛`´]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits as written, minus thousands separators: "$1,200.50" → "1200.50", "60%" → "60". */
export function numbersIn(text: string): string[] {
  return Array.from(text.matchAll(/\d[\d,]*(?:\.\d+)?/g), (m) => m[0].replace(/,(?=\d{3}\b)/g, "").replace(/[.,]$/, ""));
}

/** Quoted phrases of 3+ words. */
export function quotesIn(text: string): string[] {
  return Array.from(normalizeText(text).matchAll(/"([^"]{6,})"/g), (m) => (m[1] ?? "").trim()).filter(
    (q) => q.split(" ").length >= 3,
  );
}

export interface LineProblem {
  chapterIndex: number;
  lineIndex: number;
  problems: string[];
}

/**
 * Deterministic honesty checks (prd §6 step 6, P2): every line cites ≥ 1 of the
 * chapter's sources; every number and quote appears in a cited source; ≤ 30 words.
 */
export function checkLine(line: ScriptLine, allowed: Set<string>, sourceText: Map<string, string>): string[] {
  const problems: string[] = [];
  const cited = line.sourceIds.filter((id) => allowed.has(id));
  if (cited.length === 0) problems.push("cites no valid source");
  const words = line.text.trim().split(/\s+/).length;
  if (words > MAX_WORDS_PER_LINE) problems.push(`${words} words (max ${MAX_WORDS_PER_LINE})`);
  const haystack = normalizeText(cited.map((id) => sourceText.get(id) ?? "").join("\n"));
  const sourceNumbers = new Set(numbersIn(haystack));
  for (const n of numbersIn(line.text)) {
    if (!sourceNumbers.has(n)) problems.push(`number ${n} is not in the cited sources`);
  }
  for (const q of quotesIn(line.text)) {
    if (!haystack.includes(q)) problems.push(`quote "${q}" is not in the cited sources`);
  }
  return problems;
}

export function findProblems(script: EpisodeScript, sourceText: Map<string, string>): LineProblem[] {
  const problems: LineProblem[] = [];
  script.chapters.forEach((chapter, chapterIndex) => {
    const allowed = new Set(chapter.sources.map((s) => s.itemId));
    chapter.lines.forEach((line, lineIndex) => {
      const p = checkLine(line, allowed, sourceText);
      if (p.length) problems.push({ chapterIndex, lineIndex, problems: p });
    });
  });
  return problems;
}

const repairSchema = z.object({ line: scriptLineSchema.nullable() });

async function regenerateLine(options: {
  model: ModelClient;
  chapter: ScriptChapter;
  line: ScriptLine;
  problems: string[];
  sourceText: Map<string, string>;
}): Promise<ScriptLine | null> {
  const { chapter, line } = options;
  const idFor = new Map(chapter.sources.map((s, i) => [s.itemId, `S${i + 1}`]));
  const itemFor = new Map(chapter.sources.map((s, i) => [`S${i + 1}`, s.itemId]));
  const sources = chapter.sources
    .map((s, i) => `[S${i + 1}] ${s.label} — "${s.title}"\n${(options.sourceText.get(s.itemId) ?? "").slice(0, 3500)}`)
    .join("\n\n");
  const result = await generateStructured({
    client: options.model,
    system: WRITER_SYSTEM,
    prompt: `Sources:\n${sources}\n\nThis line from the chapter "${chapter.title}" failed a fact check:\n"${line.text}" (cited ${line.sourceIds
      .map((id) => idFor.get(id) ?? id)
      .join(", ")})\nProblems: ${options.problems.join("; ")}\n\nRewrite it so it is fully supported by the sources, or return null if it can't be.\nReturn {"line": {"text": "...", "sourceIds": ["S1"]}} or {"line": null}.`,
    schema: repairSchema,
    temperature: 0.2,
    maxTokens: 300,
  });
  if (!result.line) return null;
  return { text: result.line.text, sourceIds: result.line.sourceIds.map((s) => itemFor.get(s) ?? s) };
}

/** Trim to the budget from the end of the longest chapters, keeping at least two lines each. */
export function fitBudget(script: EpisodeScript, maxChars: number): EpisodeScript {
  const out: EpisodeScript = { ...script, chapters: script.chapters.map((c) => ({ ...c, lines: [...c.lines] })) };
  while (scriptCharacters(out) > maxChars) {
    const longest = [...out.chapters].sort((a, b) => b.lines.length - a.lines.length)[0];
    if (longest && longest.lines.length > 2) {
      longest.lines.pop();
    } else if (out.chapters.length > 1) {
      out.chapters.pop();
    } else {
      break;
    }
  }
  return out;
}

export interface CheckReport {
  script: EpisodeScript;
  regenerated: number;
  dropped: number;
  problemsFound: number;
}

/**
 * Step 6: check, regenerate failing lines once, re-check, drop what still fails,
 * remove chapters left empty, and fit the character budget.
 */
export async function checkScript(options: {
  model: ModelClient | null;
  script: EpisodeScript;
  sourceText: Map<string, string>;
  maxChars: number;
}): Promise<CheckReport> {
  const { model, sourceText } = options;
  const script: EpisodeScript = {
    ...options.script,
    chapters: options.script.chapters.map((c) => ({ ...c, lines: [...c.lines] })),
  };
  const problems = findProblems(script, sourceText);
  let regenerated = 0;
  let dropped = 0;

  for (const problem of problems) {
    const chapter = script.chapters[problem.chapterIndex];
    const line = chapter?.lines[problem.lineIndex];
    if (!chapter || !line) continue;
    let replacement: ScriptLine | null = null;
    if (model) {
      try {
        replacement = await regenerateLine({ model, chapter, line, problems: problem.problems, sourceText });
      } catch {
        replacement = null;
      }
    }
    const allowed = new Set(chapter.sources.map((s) => s.itemId));
    if (replacement && checkLine(replacement, allowed, sourceText).length === 0) {
      chapter.lines[problem.lineIndex] = replacement;
      regenerated++;
    } else {
      chapter.lines[problem.lineIndex] = { text: "", sourceIds: [] };
      dropped++;
    }
  }
  for (const chapter of script.chapters) chapter.lines = chapter.lines.filter((l) => l.text !== "");
  script.chapters = script.chapters.filter((c) => c.lines.length > 0);

  return { script: fitBudget(script, options.maxChars), regenerated, dropped, problemsFound: problems.length };
}
