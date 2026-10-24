import { redirect } from "next/navigation";
import { SampleAudioProvider } from "@/features/landing/sample-player";
import {
  Faq,
  FinalCta,
  Hero,
  HowItWorks,
  LandingFooter,
  LandingHeader,
  NewsTopics,
  NoRepeats,
  Pricing,
} from "@/features/landing/sections";
import { auth0 } from "@/lib/auth0";

export default async function LandingPage() {
  const session = await auth0.getSession();
  if (session) redirect("/today");

  return (
    <SampleAudioProvider>
      <LandingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <NoRepeats />
        <NewsTopics />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </SampleAudioProvider>
  );
}
