import type { EpisodeDeps } from "./deps";
import { failEpisode, prepareScript, publishEpisode, renderEpisodeCover, startEpisode, voiceEpisode } from "./steps";

export type MakeEpisodeResult =
  | { status: "ready"; episodeId: string }
  | { status: "skipped"; message: string }
  | { status: "failed"; episodeId: string; message: string };

/**
 * The whole pipeline in one process: used by the poller and the CLI. The
 * Temporal workflow calls the same steps as separate, retried activities.
 */
export async function makeEpisode(deps: EpisodeDeps, requestId: string): Promise<MakeEpisodeResult> {
  const started = await startEpisode(deps, requestId);
  if (started.status === "skipped") return started;
  const { episodeId } = started;
  try {
    const prepared = await prepareScript(deps, episodeId);
    if (prepared.status === "skipped") return prepared;
    await voiceEpisode(deps, episodeId);
    await renderEpisodeCover(deps, episodeId);
    await publishEpisode(deps, episodeId);
    return { status: "ready", episodeId };
  } catch (error) {
    await failEpisode(deps, episodeId, error);
    return { status: "failed", episodeId, message: error instanceof Error ? error.message : String(error) };
  }
}
