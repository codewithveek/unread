import { CHARS_PER_MINUTE, FREE_EPISODES_PER_MONTH, PLUS_MONTHLY_CHARACTERS } from "@unread/core/plans";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { rotateAliasAction, rotateFeedAction } from "@/features/settings/actions";
import { DeleteAccountForm, EpisodePrefsForm, PromoForm, VoiceForm } from "@/features/settings/forms";
import { planContextFor } from "@/features/settings/plan-context";
import { StudioPreviewButton, StudioVoiceForm } from "@/features/settings/studio-voice-form";
import { DEFAULT_ELEVENLABS_VOICE, studioVoices } from "@/features/settings/studio-voices";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { requireUser } from "@/features/users/current-user";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const { user, sessionUser } = await requireUser("/settings");
  const ctx = await planContextFor(user.id);
  const env = serverEnv();
  const billingReady = Boolean(env.BACHS_API_KEY && env.BACHS_PLUS_MONTHLY_PRODUCT_ID);
  const paid = ctx.plan.source === "paid";
  const planLabel = paid ? "Plus" : ctx.plan.source === "trial" ? "Plus trial" : "Free";
  const trial = ctx.plan.trial;
  const voices = ctx.plan.plan === "plus" ? await studioVoices() : [];
  const studioReady = Boolean(env.ELEVENLABS_API_KEY);

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeading eyebrow="SETTINGS" title="Settings" />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <SectionCard id="plan" title={`Plan: ${planLabel}`} description={paid ? "Studio voices, daily episodes and up to 20 minutes." : "Free: a weekly digest in a free voice, up to 10 minutes."}>
            {ctx.plan.plan === "free" ? (
              <Meter value={ctx.usage.episodesMade} max={FREE_EPISODES_PER_MONTH} label={`${ctx.usage.episodesMade} of ${FREE_EPISODES_PER_MONTH} episodes this month`} />
            ) : trial ? (
              <p className="m-0 text-sm text-text-2">
                Trial: {trial.episodesLeft} of {trial.episodeLimit} Studio episodes left · ends{" "}
                {trial.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: user.timezone })}
              </p>
            ) : (
              <Meter
                value={ctx.usage.charactersUsed}
                max={PLUS_MONTHLY_CHARACTERS}
                label={`${Math.round(ctx.usage.charactersUsed / CHARS_PER_MINUTE)} of ${Math.round(PLUS_MONTHLY_CHARACTERS / CHARS_PER_MINUTE)} Studio minutes this month`}
              />
            )}
            {!paid && billingReady ? (
              <form action="/billing/checkout" method="post" className="grid grid-cols-2 gap-2">
                <Button type="submit" name="plan" value="monthly">
                  Upgrade monthly
                </Button>
                {env.BACHS_PLUS_YEARLY_PRODUCT_ID ? (
                  <Button type="submit" name="plan" value="yearly" variant="secondary">
                    Yearly
                  </Button>
                ) : null}
              </form>
            ) : null}
            {paid ? (
              <form action="/billing/portal" method="post">
                <Button type="submit" variant="secondary">
                  Manage billing
                </Button>
              </form>
            ) : null}
            {!paid ? (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[13px] font-semibold text-text-2">Have a promo code?</span>
                <PromoForm />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Episodes">
            <EpisodePrefsForm
              isPlus={ctx.plan.plan === "plus"}
              initial={{
                episodeMinutes: user.episodeMinutes,
                deliveryTime: user.deliveryTime,
                timezone: user.timezone,
                cadence: user.cadence,
                weeklyDay: user.weeklyDay,
              }}
            />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <SectionCard
            title="Voice"
            description={ctx.plan.plan === "plus" ? "Studio episodes use ElevenLabs. When Plus ends, episodes switch to this free voice." : "Free episodes use Kokoro, an open voice model that runs on our servers."}
          >
            {ctx.plan.plan === "plus" && voices.length > 0 ? (
              <StudioVoiceForm
                voices={voices}
                selected={user.elevenlabsVoiceId ?? DEFAULT_ELEVENLABS_VOICE}
                quality={user.voiceQuality}
                canUseStudio={paid}
              />
            ) : null}
            {ctx.plan.plan === "free" && studioReady ? <StudioPreviewButton voiceId={DEFAULT_ELEVENLABS_VOICE} /> : null}
            <h3 className="m-0 pt-2 text-[13px] font-semibold text-text-2">{ctx.plan.plan === "plus" ? "Free voice (used if Plus ends)" : "Free voice"}</h3>
            <VoiceForm kokoroVoiceId={user.kokoroVoiceId} />
          </SectionCard>

          <SectionCard title="Private addresses" description="Reset either one if it ever leaks. The old one stops working at once.">
            <div className="flex flex-col gap-1">
              <form action={rotateFeedAction}>
                <Button type="submit" variant="link" className="h-11 px-0">
                  Reset podcast feed URL
                </Button>
              </form>
              <form action={rotateAliasAction}>
                <Button type="submit" variant="link" className="h-11 px-0">
                  Reset forwarding address
                </Button>
              </form>
            </div>
          </SectionCard>

          <SectionCard title="Account" description={user.email ?? sessionUser.email ?? undefined}>
            <Button asChild variant="secondary" className="self-start">
              {/* Plain <a>: auth routes must not be prefetched. */}
              <a href="/auth/logout">Sign out</a>
            </Button>
            <DeleteAccountForm />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
