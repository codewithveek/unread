import type { PipelineStep } from "@unread/db";
import { EpisodeCover } from "./episode-cover";
import type { EpisodeDateParts } from "./format-date";
import { PIPELINE_STEPS, type StepState } from "./pipeline-steps";
import { StepProgress } from "./step-progress";

/** prd §9: while the episode is being made, Home shows step progress. */
export function InProgressCard({ seed, date, currentStep }: { seed: string; date: EpisodeDateParts; currentStep: string | null }) {
  const at = currentStep ? PIPELINE_STEPS.indexOf(currentStep as PipelineStep) : -1;
  const states = Object.fromEntries(
    PIPELINE_STEPS.map((step, i) => [step, (i < at ? "done" : i === at ? "active" : "pending") as StepState]),
  );
  return (
    <section aria-label="Episode in progress" aria-busy="true" className="overflow-hidden rounded-[20px] border border-line bg-surface">
      <EpisodeCover seed={seed} day={date.day} caption={date.caption} muted />
      <div className="flex flex-col gap-2 px-[18px] pt-4 pb-[18px]">
        <p className="m-0 text-[17px] font-semibold tracking-[-0.01em]">Making your episode…</p>
        <p className="m-0 text-sm text-muted-foreground">This takes a few minutes. You can leave this page.</p>
        <StepProgress states={states} className="pt-2" />
      </div>
    </section>
  );
}
