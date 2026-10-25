import { VoiceNotConfiguredError } from "../voice/voice-provider";
import type { EpisodeDeps, RetryOptions } from "./deps";
import { failEpisode, prepareScript, publishEpisode, renderEpisodeCover, startEpisode, voiceEpisode } from "./steps";

export type MakeEpisodeResult =
  | { status: "ready"; episodeId: string }
  | { status: "skipped"; message: string }
  | { status: "failed"; episodeId: string; message: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry one step like Temporal would. Steps are idempotent and voice clips are
 * cached, so a retry after a brief model/provider/DB error is cheap. Missing
 * configuration won't fix itself, so it isn't retried.
 */
export async function withRetry<T>(run: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, initialDelayMs = 5000 } = options;
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || error instanceof VoiceNotConfiguredError) throw error;
      await sleep(initialDelayMs * 2 ** (attempt - 1));
    }
  }
}

/**
 * The whole pipeline in one process: used by the poller and the CLI. The
 * Temporal workflow calls the same steps as separate, retried activities.
 */
export async function makeEpisode(deps: EpisodeDeps, requestId: string): Promise<MakeEpisodeResult> {
  const retry = deps.retry ?? {};
  const started = await withRetry(() => startEpisode(deps, requestId), retry);
  if (started.status === "skipped") return started;
  const { episodeId } = started;
  try {
    const prepared = await withRetry(() => prepareScript(deps, episodeId), retry);
    if (prepared.status === "skipped") return prepared;
    await withRetry(() => voiceEpisode(deps, episodeId), retry);
    await withRetry(() => renderEpisodeCover(deps, episodeId), retry);
    await withRetry(() => publishEpisode(deps, episodeId), retry);
    return { status: "ready", episodeId };
  } catch (error) {
    await failEpisode(deps, episodeId, error);
    return { status: "failed", episodeId, message: error instanceof Error ? error.message : String(error) };
  }
}
