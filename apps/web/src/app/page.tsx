import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/features/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";

export default async function LandingPage() {
  const session = await auth0.getSession();
  if (session) redirect("/today");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-between gap-10 px-6 pt-6 pb-10">
      <BrandMark />
      <div className="flex flex-col gap-4">
        <p className="m-0 font-mono text-[13px] font-medium tracking-[0.02em] text-muted-foreground">
          YOUR NEWSLETTERS, AS A PODCAST
        </p>
        <h1 className="m-0 text-[40px] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[52px]">
          Your newsletters, minus the overlap, in 10 minutes of audio.
        </h1>
        <p className="m-0 text-base leading-[1.5] text-muted-foreground">
          Forward your newsletters to Unread. We merge the stories they share, summarise what matters with a source for
          every line, and deliver one short episode to the podcast app you already use.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Plain <a>: auth routes must not be prefetched. */}
        <Button asChild size="lg">
          <a href="/auth/login?screen_hint=signup&returnTo=/today">Get started</a>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <a href="/auth/login?returnTo=/today">Sign in</a>
        </Button>
      </div>
      <Link href="/privacy" className="text-sm text-muted-foreground">
        Privacy: what we store and who sees it
      </Link>
    </main>
  );
}
