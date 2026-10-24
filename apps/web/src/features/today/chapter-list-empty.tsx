import { StepProgress } from "./step-progress";

/** "In this episode", before there are chapters: what each morning's run does. */
export function ChapterListEmpty() {
  return (
    <section aria-labelledby="in-this-episode" className="flex flex-col gap-1">
      <h2 id="in-this-episode" className="m-0 text-[15px] font-semibold">
        In this episode
      </h2>
      <p className="m-0 pt-1 pb-2 text-sm text-muted-foreground">
        Chapters show up here once an episode is ready. For each episode, Unread:
      </p>
      <StepProgress />
    </section>
  );
}
