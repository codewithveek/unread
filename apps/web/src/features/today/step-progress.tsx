import type { PipelineStep } from "@unread/db";
import { cn } from "@/lib/utils";
import { PIPELINE_STEP_LABELS, PIPELINE_STEPS, type StepState } from "./pipeline-steps";

export interface StepProgressProps {
  states?: Partial<Record<PipelineStep, StepState>>;
  /** Extra text for a step, e.g. "23 of 61 lines" while voicing. */
  details?: Partial<Record<PipelineStep, string>>;
  className?: string;
}

/** The step list shown while an episode is being made. */
export function StepProgress({ states = {}, details = {}, className }: StepProgressProps) {
  return (
    <ol className={cn("m-0 flex list-none flex-col p-0", className)}>
      {PIPELINE_STEPS.map((step, index) => {
        const state = states[step] ?? "pending";
        return (
          <li key={step} className="flex items-center gap-3 border-b border-surface-2 py-2.5 last:border-b-0">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 flex-none items-center justify-center rounded-full font-mono text-[11px]",
                state === "done" && "bg-brand text-on-brand",
                state === "active" && "border border-brand text-brand",
                state === "pending" && "border border-line text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span className={cn("text-sm", state === "pending" ? "text-muted-foreground" : "text-foreground")}>
              {PIPELINE_STEP_LABELS[step]}
            </span>
            {state === "active" && details[step] ? (
              <span className="ml-auto font-mono text-xs text-muted-foreground">{details[step]}</span>
            ) : null}
            <span className="sr-only">{state}</span>
          </li>
        );
      })}
    </ol>
  );
}
