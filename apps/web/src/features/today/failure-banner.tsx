import type { HomeNotice } from "@/features/episodes/queries";
import { MakeNowButton } from "./make-now-button";

/**
 * prd §12: "Today's episode couldn't be made: [reason]. Try again." Earlier
 * episodes stay. A skipped run (not enough new content, plan limit) says why,
 * so "Make one now" never ends in silence.
 */
export function FailureBanner({ notice }: { notice: HomeNotice }) {
  const failed = notice.kind === "failed";
  return (
    <section role={failed ? "alert" : "status"} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-[18px]">
      <p className="m-0 text-[15px] font-semibold">{failed ? "Today's episode couldn't be made" : "No new episode this time"}</p>
      <p className="m-0 text-sm text-muted-foreground">{failed ? `Reason: ${notice.message}.` : notice.message}</p>
      {failed ? <MakeNowButton label="Try again" variant="secondary" /> : null}
    </section>
  );
}
