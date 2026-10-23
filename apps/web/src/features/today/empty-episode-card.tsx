import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EpisodeCover } from "./episode-cover";
import type { EpisodeDateParts } from "./format-date";

export interface EmptyEpisodeCardProps {
  seed: string;
  date: EpisodeDateParts;
  deliveryTime: string;
  hasTopics: boolean;
}

/** Home's episode card before the first episode exists. */
export function EmptyEpisodeCard({ seed, date, deliveryTime, hasTopics }: EmptyEpisodeCardProps) {
  return (
    <section aria-label="Today's episode" className="overflow-hidden rounded-[20px] border border-line bg-surface">
      <EpisodeCover seed={seed} day={date.day} caption={date.caption} muted />
      <div className="flex flex-col gap-3.5 px-[18px] pt-4 pb-[18px]">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[17px] font-semibold tracking-[-0.01em]">No episode yet</p>
          <p className="m-0 text-sm leading-[1.45] text-muted-foreground">
            {hasTopics
              ? `Your first episode is on its way. After that, a new one arrives every morning at ${deliveryTime}.`
              : `Pick a few topics and we'll make your first episode. After that, a new one arrives every morning at ${deliveryTime}.`}
          </p>
        </div>
        {hasTopics ? null : (
          <Button asChild size="lg" className="self-start">
            <Link href="/topics">Pick your topics</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
