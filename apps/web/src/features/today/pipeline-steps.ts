import type { PipelineStep } from "@unread/db";

/** Listener-facing names for the pipeline steps (prd §6). */
export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  collect: "Finding today's stories",
  extract: "Reading the articles",
  dedupe: "Merging duplicate stories",
  plan: "Planning the episode",
  script: "Writing the script",
  check: "Checking every fact against its source",
  voice: "Recording the voice",
  cover: "Making the cover",
  publish: "Publishing to your feed",
};

export const PIPELINE_STEPS = Object.keys(PIPELINE_STEP_LABELS) as PipelineStep[];

export type StepState = "pending" | "active" | "done";
