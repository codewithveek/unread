import type { PipelineStep } from "@unread/db";
import type { EpisodeProgress } from "@/features/episodes/queries";
import { EpisodeCover } from "./episode-cover";
import type { EpisodeDateParts } from "./format-date";
import { PIPELINE_STEPS, type StepState } from "./pipeline-steps";
import { StepProgress } from "./step-progress";

/** After this long we say so, instead of a spinner that looks the same forever. */
const SLOW_AFTER_MS = 15 * 60_000;

/** prd §9: while the episode is being made, Home shows step progress. */
export function InProgressCard({ seed, date, progress, now }: { seed: string; date: EpisodeDateParts; progress: EpisodeProgress; now: number }) {
  const at = progress.currentStep ? PIPELINE_STEPS.indexOf(progress.currentStep as PipelineStep) : -1;
  const states = Object.fromEntries(
    PIPELINE_STEPS.map((step, i) => [step, (i < at ? "done" : i === at ? "active" : "pending") as StepState]),
  );
  const slow = progress.startedAt !== null && now - new Date(progress.startedAt).getTime() > SLOW_AFTER_MS;
  const voice = progress.voice;
  const detail = voice && voice.total > 0 ? { voice: `${voice.done} of ${voice.total} lines` } : undefined;
  return (
    <section aria-label="Episode in progress" aria-busy="true" className="overflow-hidden rounded-[20px] border border-line bg-surface">
      <EpisodeCover seed={seed} day={date.day} caption={date.caption} muted />
      <div className="flex flex-col gap-2 px-[18px] pt-4 pb-[18px]">
        <p className="m-0 text-[17px] font-semibold tracking-[-0.01em]">
          {progress.startedAt ? "Making your episode…" : "Waiting to start…"}
        </p>
        <p role="status" className="m-0 text-sm text-muted-foreground">
          {slow
            ? "This is taking longer than usual. We'll keep trying; if it can't be made you'll see why here."
            : "This takes a few minutes. You can leave this page."}
        </p>
        <StepProgress states={states} details={detail} className="pt-2" />
      </div>
    </section>
  );
}
