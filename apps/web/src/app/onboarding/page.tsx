import { schema } from "@unread/db";
import { and, count, eq } from "drizzle-orm";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { FieldRow } from "@/components/ui/field-row";
import { CopyButton } from "@/components/ui/copy-button";
import { ForwardingGuides } from "@/features/forwarding/forwarding-guides";
import { LiveStatus } from "@/features/forwarding/live-status";
import { inboundStatus } from "@/features/inbound/queries";
import { NewsForm } from "@/features/news/news-form";
import { FinishForm } from "@/features/onboarding/finish-form";
import { planContextFor } from "@/features/settings/plan-context";
import { BrandMark } from "@/features/shell/brand-mark";
import { requireUser } from "@/features/users/current-user";
import { forwardingAddress } from "@/features/users/forwarding-address";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Set up", robots: { index: false } };

const STEPS = 3;

function StepHeader({ step, skipHref }: { step: number; skipHref: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-xs font-medium text-muted-foreground">
        STEP {step} OF {STEPS}
      </span>
      <Link href={skipHref as Route} className="py-3 text-sm no-underline">
        Skip
      </Link>
    </div>
  );
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { user } = await requireUser("/onboarding");
  const step = Math.min(STEPS, Math.max(1, Number((await searchParams).step ?? 1) || 1));
  const address = forwardingAddress(user.inboundAlias);
  const [status, ctx, topics, queued] = await Promise.all([
    inboundStatus(user.id),
    planContextFor(user.id),
    db().select().from(schema.userTopics).where(eq(schema.userTopics.userId, user.id)),
    db()
      .select({ n: count() })
      .from(schema.items)
      .where(and(eq(schema.items.userId, user.id), eq(schema.items.status, "queued"))),
  ]);
  const hasNewsletters = status.newsletters.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-6 px-6 pt-6 pb-10">
      <BrandMark />
      {step === 1 ? (
        <>
          <StepHeader step={1} skipHref="/onboarding?step=2" />
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">Forward your newsletters here</h1>
            <p className="m-0 text-[15px] leading-[1.45] text-muted-foreground">
              Every issue you forward becomes part of one short episode, with the overlap removed and a source for every story.
            </p>
          </div>
          <FieldRow action={<CopyButton value={address} />}>{address}</FieldRow>
          <LiveStatus initial={status} />
          <section aria-label="Set up auto-forwarding" className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4">
            <h2 className="m-0 text-base font-semibold">Recommended: forward automatically</h2>
            <ForwardingGuides />
          </section>
          <Link href={"/onboarding?step=2" as Route} className="flex h-[54px] items-center justify-center rounded-full bg-brand text-base font-semibold text-on-brand no-underline hover:text-on-brand">
            Continue
          </Link>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <StepHeader step={2} skipHref="/onboarding?step=3" />
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">Want us to catch you up on the news too?</h1>
            <p className="m-0 text-[15px] leading-[1.45] text-muted-foreground">Optional. Pick topics and an edition; we never assume your location.</p>
          </div>
          <NewsForm
            initial={{ optIn: user.newsOptIn, mode: user.newsMode, country: user.newsCountry, language: user.newsLanguage, topics: topics.map((t) => t.label) }}
            submitLabel="Continue"
            nextHref="/onboarding?step=3"
            hasNewsletters={hasNewsletters}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <span className="font-mono text-xs font-medium text-muted-foreground">STEP 3 OF {STEPS}</span>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">How should it sound?</h1>
            <p className="m-0 text-[15px] leading-[1.45] text-muted-foreground">Length, timing and voice. You can change all of this later.</p>
          </div>
          <FinishForm
            prefs={{
              isPlus: ctx.plan.plan === "plus",
              initial: {
                episodeMinutes: user.episodeMinutes,
                deliveryTime: user.deliveryTime,
                timezone: user.timezone,
                cadence: user.cadence,
                weeklyDay: user.weeklyDay,
              },
            }}
            voice={user.kokoroVoiceId}
            canMakeNow={(queued[0]?.n ?? 0) >= 2 || (user.newsOptIn && topics.length > 0)}
          />
        </>
      ) : null}
    </main>
  );
}
