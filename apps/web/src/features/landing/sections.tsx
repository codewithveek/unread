import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/features/player/icons";
import { BrandMark } from "@/features/shell/brand-mark";
import { cn } from "@/lib/utils";
import { CHAPTERS, FAQS, FREE_FEATURES, PLUS_FEATURES, PLUS_PRICE, SIGN_IN_HREF, SIGN_UP_HREF, STEPS, TOPICS } from "./content";
import { ChapterPlayButton, SampleCard } from "./sample-player";

/** Rounded-rectangle CTA from the canvas (the app's buttons are pills). */
const ctaClass = "h-12 rounded-xl px-5 text-[15px] font-semibold";
const navLinkClass = "inline-flex min-h-11 items-center text-muted-foreground no-underline hover:text-foreground";

function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-6", className)}>{children}</div>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs font-medium tracking-[0.08em] text-brand">{children}</span>;
}

function SectionTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h2 className={cn("m-0 text-[clamp(34px,4.2vw,56px)] leading-[1.02] font-bold tracking-[-0.035em]", className)}>
      {children}
    </h2>
  );
}

/** Eyebrow on the left, heading block pushed right; stacks on narrow screens. */
function SplitHeading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="flex flex-[0_1_620px] flex-col gap-3.5">{children}</div>
    </div>
  );
}

export function LandingHeader() {
  return (
    <header className="border-b border-surface-2">
      <Container className="flex items-center justify-between gap-4 py-3.5">
        <a href="#top" className="no-underline" aria-label="Unread, back to top">
          <BrandMark />
        </a>
        <nav aria-label="Main" className="flex items-center gap-6 text-sm">
          <a href="#how" className={cn(navLinkClass, "hidden md:inline-flex")}>
            How it works
          </a>
          <a href="#pricing" className={cn(navLinkClass, "hidden md:inline-flex")}>
            Pricing
          </a>
          <a href="#faq" className={cn(navLinkClass, "hidden md:inline-flex")}>
            FAQ
          </a>
          {/* Plain <a>: auth routes must not be prefetched. */}
          <a href={SIGN_IN_HREF} className={navLinkClass}>
            Sign in
          </a>
          <Button asChild className="h-11 rounded-[10px] px-4 font-semibold">
            <a href={SIGN_UP_HREF}>Start free</a>
          </Button>
        </nav>
      </Container>
    </header>
  );
}

function CoverArt() {
  const accentBars = [
    { x: 40, y: 250, h: 190, o: 1 },
    { x: 76, y: 190, h: 250, o: 0.5 },
    { x: 112, y: 300, h: 140, o: 1 },
    { x: 148, y: 150, h: 290, o: 0.3 },
    { x: 184, y: 230, h: 210, o: 1 },
    { x: 220, y: 330, h: 110, o: 0.5 },
    { x: 256, y: 200, h: 240, o: 1 },
  ];
  const faintBars = [
    { x: 292, y: 270, h: 170 },
    { x: 328, y: 320, h: 120 },
    { x: 364, y: 240, h: 200 },
    { x: 400, y: 350, h: 90 },
  ];
  return (
    <svg role="img" aria-label="Unread episode cover art" viewBox="0 0 480 480" className="block h-auto w-full rounded-[28px]">
      <rect width="480" height="480" rx="28" fill="var(--surface)" />
      {accentBars.map((b) => (
        <rect key={b.x} x={b.x} y={b.y} width="22" height={b.h} rx="11" fill="var(--brand)" opacity={b.o} />
      ))}
      {faintBars.map((b) => (
        <rect key={b.x} x={b.x} y={b.y} width="22" height={b.h} rx="11" fill="var(--text)" opacity="0.12" />
      ))}
      <text x="440" y="96" textAnchor="end" fill="var(--text)" fontFamily="var(--font-geist-sans)" fontSize="88" fontWeight="700" letterSpacing="-4">
        27
      </text>
      <text x="440" y="126" textAnchor="end" fill="var(--muted-text)" fontFamily="var(--font-geist-mono)" fontSize="16">
        OCT · TUESDAY BRIEF
      </text>
    </svg>
  );
}

export function Hero() {
  return (
    <section id="top">
      <Container className="flex flex-wrap items-center gap-12 pt-[72px] pb-16">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-6">
          <Eyebrow>FOR EVERYONE WITH TOO MANY NEWSLETTERS</Eyebrow>
          <h1 className="m-0 text-[clamp(44px,6.4vw,84px)] leading-[0.98] font-bold tracking-[-0.045em]">
            Your newsletters, as one short{" "}
            <span className="text-transparent [-webkit-text-stroke:1.5px_var(--text)]">podcast.</span>
          </h1>
          <p className="m-0 max-w-[520px] text-lg leading-[1.55] text-muted-foreground">
            Forward the newsletters piling up in your inbox. Each morning, Unread turns them into one short episode for
            your commute, walk or workout.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className={ctaClass}>
              <a href={SIGN_UP_HREF}>Make my first episode</a>
            </Button>
            <Button asChild variant="secondary" className={cn(ctaClass, "bg-transparent font-medium")}>
              <a href="#sample">Play a sample</a>
            </Button>
          </div>
          <p className="-mt-3 mb-0 text-[13px] text-muted-foreground">Free to start · No card needed · Set up in 2 minutes</p>
          <SampleCard />
        </div>
        <div className="min-w-0 flex-[1_1_380px]">
          <CoverArt />
        </div>
      </Container>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-4 border-t border-surface-2">
      <Container className="flex flex-col gap-12 py-[88px]">
        <SplitHeading eyebrow="HOW IT WORKS">
          <SectionTitle>Set it up once. Listen every day.</SectionTitle>
        </SplitHeading>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 p-0">
          {STEPS.map((step) => (
            <li key={step.number} className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-7">
              <span className="font-mono text-[13px] font-medium text-brand">{step.number}</span>
              <h3 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{step.title}</h3>
              <p className="m-0 text-[15px] leading-[1.55] text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function ChapterArt({ cx, strength }: { cx: number; strength: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="block size-full">
      <circle cx={cx} cy="150" r="120" fill="var(--brand)" opacity={strength} />
      <g fill="none" stroke="var(--text)" strokeOpacity="0.12" strokeWidth="2">
        <circle cx={cx} cy="150" r="150" />
        <circle cx={cx} cy="150" r="190" />
        <circle cx={cx} cy="150" r="230" />
      </g>
    </svg>
  );
}

export function NoRepeats() {
  return (
    <section className="border-t border-surface-2 bg-ground-2">
      <Container className="flex flex-col gap-12 py-[88px]">
        <SplitHeading eyebrow="NO REPEATS">
          <SectionTitle>Hear each story once.</SectionTitle>
          <p className="m-0 text-base leading-[1.55] text-muted-foreground">
            Five newsletters covering the same news? You hear it once, and every chapter links back to the original
            issues.
          </p>
        </SplitHeading>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {CHAPTERS.map((chapter, i) => (
            <article key={chapter.title} className="flex flex-col gap-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-line bg-surface">
                <ChapterArt cx={chapter.cx} strength={chapter.strength} />
                <span className="absolute bottom-4 left-4 rounded-lg bg-ground px-2.5 py-1.5 font-mono text-xs font-medium">
                  {chapter.merged}
                </span>
                <ChapterPlayButton
                  label={`chapter ${i + 1}: ${chapter.title}`}
                  startSeconds={chapter.startSeconds}
                  endSeconds={CHAPTERS[i + 1]?.startSeconds ?? Number.POSITIVE_INFINITY}
                  className="absolute right-4 bottom-4"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-xs font-medium text-muted-foreground">{chapter.meta}</span>
                <h3 className="m-0 text-[19px] font-semibold tracking-[-0.015em]">{chapter.title}</h3>
              </div>
            </article>
          ))}
        </div>
        <p className="m-0 text-[13px] text-dim">Example episode.</p>
      </Container>
    </section>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 flex-none text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function NewsTopics() {
  return (
    <section className="border-t border-surface-2">
      <Container className="flex flex-wrap gap-12 py-[88px]">
        <div className="flex flex-[1_1_320px] flex-col gap-4">
          <Eyebrow>OPTIONAL · NEWS</Eyebrow>
          <SectionTitle>Want the news too?</SectionTitle>
          <p className="m-0 text-base leading-[1.55] text-muted-foreground">
            Pick a few topics and we&apos;ll add the day&apos;s biggest stories. Prefer just your newsletters? Leave it
            off.
          </p>
        </div>
        <ul className="m-0 flex flex-[1_1_520px] list-none flex-col p-0">
          {TOPICS.map((topic) => (
            <li key={topic} className="flex items-center justify-between border-b border-surface-2 py-4">
              <span className="text-[clamp(22px,2.6vw,30px)] font-semibold tracking-[-0.02em]">{topic}</span>
              <ArrowUpRightIcon />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] text-text-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-4 border-t border-surface-2 bg-ground-2">
      <Container className="flex flex-col gap-12 py-[88px]">
        <SplitHeading eyebrow="PRICING">
          <SectionTitle>Free every week. Every day on Plus.</SectionTitle>
        </SplitHeading>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
          <div className="flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-7">
            <div className="flex flex-col gap-1.5">
              <h3 className="m-0 text-[22px] font-semibold">Free</h3>
              <p className="m-0 text-[40px] font-bold tracking-[-0.03em]">$0</p>
            </div>
            <FeatureList items={FREE_FEATURES} />
            <Button asChild variant="secondary" className={cn(ctaClass, "mt-auto w-full bg-transparent")}>
              <a href={SIGN_UP_HREF}>Start free</a>
            </Button>
          </div>
          <div className="flex flex-col gap-5 rounded-[20px] border border-brand bg-surface p-7">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h3 className="m-0 text-[22px] font-semibold">Plus</h3>
                <span className="font-mono text-xs font-medium text-brand">STUDIO VOICES</span>
              </div>
              <p className="m-0 text-[40px] font-bold tracking-[-0.03em]">
                {PLUS_PRICE}
                <span className="text-base font-medium tracking-normal text-muted-foreground"> / month</span>
              </p>
            </div>
            <FeatureList items={PLUS_FEATURES} />
            <Button asChild className={cn(ctaClass, "mt-auto w-full")}>
              <a href={SIGN_UP_HREF}>Upgrade to Plus</a>
            </Button>
            <p className="m-0 text-center text-[13px] text-muted-foreground">Got a promo code? Try Plus free. No card needed.</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-4 border-t border-surface-2">
      <Container className="flex flex-wrap gap-12 py-[88px]">
        <div className="flex flex-[1_1_320px] flex-col gap-4">
          <Eyebrow>FAQ</Eyebrow>
          <SectionTitle>Good questions.</SectionTitle>
        </div>
        <div className="flex flex-[1_1_520px] flex-col">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group border-b border-surface-2 py-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDownIcon className="size-5 flex-none text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 mb-0 text-[15px] leading-[1.6] text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="bg-brand text-on-brand">
      <Container className="flex flex-col items-center gap-5 py-[88px] text-center">
        <h2 className="m-0 text-[clamp(36px,5vw,64px)] leading-[1.02] font-bold tracking-[-0.04em]">
          Catch up on every newsletter without reading one.
        </h2>
        <p className="m-0 max-w-[520px] text-[17px] leading-[1.55]">
          Setup takes two minutes. Your first episode is ready as soon as a newsletter arrives.
        </p>
        <a
          href={SIGN_UP_HREF}
          className="inline-flex h-12 items-center rounded-xl bg-on-brand px-[22px] text-[15px] font-semibold text-foreground no-underline hover:bg-on-brand/90 hover:text-foreground focus-visible:outline-on-brand"
        >
          Make my first episode
        </a>
        <p className="m-0 text-[13px]">Free to start · No card needed</p>
      </Container>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-surface-2">
      <Container className="flex flex-wrap items-center justify-between gap-6 py-10 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground">
          <span aria-hidden="true" className="inline-block size-2 rounded-full bg-brand" />
          <span className="font-bold">Unread</span>
          <span className="font-normal text-dim">· getunread.site</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <a href="#how" className={navLinkClass}>
            How it works
          </a>
          <a href="#pricing" className={navLinkClass}>
            Pricing
          </a>
          <Link href="/privacy" className={navLinkClass}>
            Privacy
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
