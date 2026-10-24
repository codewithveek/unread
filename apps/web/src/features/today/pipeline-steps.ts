import type { PipelineStep } from "@unread/db";

/** Listener-facing names for the pipeline steps (prd §6). */
export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  collect: "Gathering new newsletters and links",
  extract: "Splitting issues into stories",
  cluster: "Merging stories covered more than once",
  plan: "Planning the episode",
  script: "Writing the script",
  check: "Checking every fact against its source",
  voice: "Recording the voice",
  cover: "Making the cover",
  publish: "Publishing to your feed",
};

export const PIPELINE_STEPS = Object.keys(PIPELINE_STEP_LABELS) as PipelineStep[];

export type StepState = "pending" | "active" | "done";
