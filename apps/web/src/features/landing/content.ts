/** Landing page copy and sample data, from docs/design/Landing.dc.html. */

/** Plain <a> targets: auth routes must not be prefetched. /today sends new users to onboarding. */
export const SIGN_UP_HREF = "/auth/login?screen_hint=signup&returnTo=/today";
export const SIGN_IN_HREF = "/auth/login?returnTo=/today";

/** Placeholder in the design; the real price lives in Bachs. Replace before launch. */
export const PLUS_PRICE = "";

/** Sample episode played by the hero card and the chapter buttons. Drop the file into apps/web/public. */
export const SAMPLE_EPISODE = {
  src: "/sample-episode.mp3",
  title: "Sample: 6 newsletters in 9 minutes",
  /** Shown until the audio's metadata loads. */
  durationSeconds: 8 * 60 + 40,
} as const;

export const STEPS = [
  {
    number: "01",
    title: "Forward your newsletters",
    body: "Send them to your Unread address, or let Gmail, Outlook or Apple Mail forward them for you.",
  },
  {
    number: "02",
    title: "We do the reading",
    body: "Unread picks out what matters, cuts the repeats and keeps it short.",
  },
  {
    number: "03",
    title: "Press play",
    body: "Listen here, or in Apple Podcasts or Pocket Casts. New episodes show up on their own.",
  },
] as const;

export interface SampleChapter {
  title: string;
  meta: string;
  merged: string;
  /** Where this chapter starts in the sample episode; keep in sync with the audio file. */
  startSeconds: number;
  /** Art: horizontal position and strength of the accent circle. */
  cx: number;
  strength: number;
}

export const CHAPTERS: readonly SampleChapter[] = [
  { title: "Why AI pricing changed again this week", meta: "CHAPTER 1 · 2:10", merged: "FROM 4 NEWSLETTERS", startSeconds: 20, cx: 120, strength: 0.85 },
  { title: "The fundraising round everyone wrote about", meta: "CHAPTER 2 · 1:45", merged: "FROM 3 NEWSLETTERS", startSeconds: 150, cx: 280, strength: 0.55 },
  { title: "A design essay you saved and never opened", meta: "CHAPTER 3 · 2:30", merged: "YOUR SAVED LINK", startSeconds: 255, cx: 200, strength: 0.3 },
];

export const TOPICS = ["AI", "Startups", "Markets", "Science", "Football", "Design", "Climate"] as const;

export const FREE_FEATURES = [
  "One episode a week",
  "Up to 10 minutes",
  "4 voices to choose from",
  "Optional news topics",
  "Works in your podcast app",
] as const;

export const PLUS_FEATURES = [
  "A fresh episode every morning",
  "5, 10 or 20 minutes",
  "Studio-quality voices, and a library to pick from",
  "Everything in Free",
] as const;

export const FAQS = [
  {
    q: "Which newsletters work?",
    a: "Any newsletter that arrives by email: Substack, Beehiiv, Ghost, company updates and more. You choose which senders go into episodes.",
  },
  {
    q: "Who sees my newsletters?",
    a: "We use them only to make your episodes. They are never sold or shared for ads, and deleting your account deletes them.",
  },
  {
    q: "Is it the full newsletter read aloud?",
    a: "No. You get the highlights in a few minutes, with links to the full issues when you want more.",
  },
  {
    q: "Can I listen in my own podcast app?",
    a: "Yes. Add your private link to Apple Podcasts, Pocket Casts or most podcast apps once, and new episodes arrive there.",
  },
] as const;
