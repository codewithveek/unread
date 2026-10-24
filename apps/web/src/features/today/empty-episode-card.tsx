import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EpisodeCover } from "./episode-cover";
import type { EpisodeDateParts } from "./format-date";

export interface EmptyEpisodeCardProps {
  seed: string;
  date: EpisodeDateParts;
  /** "every Monday at 7:00" */
  schedule: string;
  forwardingAddress: string;
}

/** Home's episode card before the first episode exists. */
export function EmptyEpisodeCard({ seed, date, schedule, forwardingAddress }: EmptyEpisodeCardProps) {
  return (
    <section aria-label="Today's episode" className="overflow-hidden rounded-[20px] border border-line bg-surface">
      <EpisodeCover seed={seed} day={date.day} caption={date.caption} muted />
      <div className="flex flex-col gap-3.5 px-[18px] pt-4 pb-[18px]">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[17px] font-semibold tracking-[-0.01em]">No episode yet</p>
          <p className="m-0 text-sm leading-[1.45] text-muted-foreground">
            Forward a few newsletters to your Unread address and we&apos;ll turn them into one short episode. After
            that, a new one arrives {schedule}, whenever there&apos;s something new.
          </p>
        </div>
        <p className="m-0 truncate rounded-xl border border-line bg-surface-2 px-3.5 py-3 font-mono text-[13px] text-text-2">
          {forwardingAddress}
        </p>
        <Button asChild size="lg" className="self-start">
          <Link href="/sources">Set up forwarding</Link>
        </Button>
      </div>
    </section>
  );
}
