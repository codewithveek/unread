import type { z } from "zod";
import type { ModelClient } from "./model-client";

export class StructuredOutputError extends Error {}

/** Pull the first JSON object/array out of a reply (fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new StructuredOutputError("No JSON in reply");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(candidate.slice(start, i + 1));
  }
  throw new StructuredOutputError("Unterminated JSON in reply");
}

export interface StructuredRequest<T extends z.ZodType> {
  client: ModelClient;
  system: string;
  prompt: string;
  schema: T;
  /** Extra semantic checks after the schema (e.g. budget); return an error message or null. */
  validate?: (value: z.infer<T>) => string | null;
  attempts?: number;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Ask for JSON, validate with Zod, and feed errors back for up to `attempts`
 * tries (prd §5 repair loop). Gemma has no JSON mode, so the prompt carries the contract.
 */
export async function generateStructured<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T>> {
  const attempts = request.attempts ?? 3;
  let prompt = request.prompt;
  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const reply = await request.client.complete({
      system: `${request.system}\n\nReply with a single JSON value only, no prose, no code fence.`,
      prompt,
      temperature: attempt === 1 ? request.temperature : 0.2,
      maxTokens: request.maxTokens,
    });
    try {
      const parsed = request.schema.safeParse(extractJson(reply.text));
      if (!parsed.success) {
        lastError = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      } else {
        const semantic = request.validate?.(parsed.data) ?? null;
        if (!semantic) return parsed.data;
        lastError = semantic;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    prompt = `${request.prompt}\n\nYour previous reply was rejected: ${lastError}\nReturn corrected JSON only.`;
  }
  throw new StructuredOutputError(`No valid output after ${attempts} attempts: ${lastError}`);
}
