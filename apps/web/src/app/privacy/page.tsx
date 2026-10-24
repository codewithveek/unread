import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/features/shell/brand-mark";

export const metadata: Metadata = { title: "Privacy", description: "What Unread stores and what each provider receives." };

const sections: { title: string; body: string[] }[] = [
  {
    title: "What we store",
    body: [
      "Your account (from Auth0), your settings, the newsletters you forward, the links you save, the episodes we make for you, and listening activity (play, skip, complete) used to rank stories.",
      "Raw forwarded emails are kept for 30 days, then deleted. Only mail from addresses you've verified is accepted; everything else is dropped without being read by any model.",
    ],
  },
  {
    title: "What Google receives (Gemma via the Gemini API)",
    body: ["The cleaned text of your newsletters and saved articles, to cluster, rank, summarise and script your episode. Nothing else about you."],
  },
  {
    title: "What ElevenLabs receives (Plus and trials only)",
    body: [
      "Only the finished episode script: our summaries, newsletter names and any short quotes kept in the script. Never your raw newsletters. Free episodes are voiced on our own servers with Kokoro, an open model.",
    ],
  },
  {
    title: "Payments",
    body: ["Plus is billed by Bachs. We never see your card; we store the subscription status Bachs sends us."],
  },
  {
    title: "Your private feed",
    body: ["Your podcast feed and audio use unguessable links that aren't indexed. You can reset them any time in Settings, which turns the old ones off."],
  },
  {
    title: "Deleting everything",
    body: ["Settings → Delete account removes every row we hold about you, plus your audio and covers, immediately."],
  },
  {
    title: "Training",
    body: ["We don't train models on your data, and we use provider tiers whose terms don't allow your content to be used for training."],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col gap-8 px-6 pt-6 pb-16">
      <Link href="/" className="no-underline" aria-label="Unread home">
        <BrandMark />
      </Link>
      <h1 className="m-0 text-[34px] leading-[1.1] font-bold tracking-[-0.03em]">Privacy</h1>
      {sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="m-0 text-lg font-semibold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="m-0 text-[15px] leading-[1.55] text-text-2">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="m-0 text-sm text-muted-foreground">Questions: hello@getunread.site</p>
    </main>
  );
}
