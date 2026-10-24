import { schema } from "@unread/db";
import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { FieldRow } from "@/components/ui/field-row";
import { SectionCard } from "@/components/ui/section-card";
import { ForwardingGuides } from "@/features/forwarding/forwarding-guides";
import { NewsForm } from "@/features/news/news-form";
import { rotateAliasAction, rotateFeedAction } from "@/features/settings/actions";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { removeItemAction, removeSenderAction, toggleNewsletterAction } from "@/features/sources/actions";
import { AddLinkForm, AddSenderForm, PrioritySelect } from "@/features/sources/forms";
import { relativeTime } from "@/features/sources/relative-time";
import { requireUser } from "@/features/users/current-user";
import { forwardingAddress } from "@/features/users/forwarding-address";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sources" };

function kindLabel(kind: string, limited: boolean): string {
  if (kind === "link") return limited ? "Link · limited (paywalled)" : "Link";
  if (kind === "news") return "News";
  return "Newsletter story";
}

export default async function SourcesPage() {
  const { user, sessionUser } = await requireUser("/sources");
  const address = forwardingAddress(user.inboundAlias);
  const feedHost = serverEnv().APP_BASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const feedUrl = `${serverEnv().APP_BASE_URL.replace(/\/$/, "")}/feed/${user.feedToken}.xml`;

  const [newsletters, senders, upNext, topics] = await Promise.all([
    db().select().from(schema.newsletters).where(eq(schema.newsletters.userId, user.id)).orderBy(desc(schema.newsletters.lastIssueAt)),
    db().select().from(schema.verifiedSenders).where(eq(schema.verifiedSenders.userId, user.id)),
    db()
      .select({ item: schema.items, newsletter: schema.newsletters })
      .from(schema.items)
      .leftJoin(schema.newsletters, eq(schema.newsletters.id, schema.items.newsletterId))
      .where(and(eq(schema.items.userId, user.id), eq(schema.items.status, "queued")))
      .orderBy(desc(schema.items.createdAt))
      .limit(40),
    db().select().from(schema.userTopics).where(eq(schema.userTopics.userId, user.id)),
  ]);

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeading eyebrow="SOURCES" title="Sources" />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <SectionCard title="Forward your newsletters here" description="Forward issues by hand or with an auto-forward rule. Only mail from the addresses below is accepted.">
            <FieldRow action={<CopyButton value={address} />}>{address}</FieldRow>
            <details className="group rounded-xl border border-line bg-ground p-3">
              <summary className="min-h-11 cursor-pointer list-none py-2.5 text-sm font-medium">Set up auto-forwarding</summary>
              <div className="pt-2">
                <ForwardingGuides />
              </div>
            </details>
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-semibold text-text-2">Allowed to forward</h3>
              <ul className="m-0 flex list-none flex-col p-0">
                {senders.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 border-b border-surface-2 py-2 last:border-b-0">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{s.email}</span>
                      {s.verifiedAt ? (
                        <span className="text-xs text-muted-foreground">Verified</span>
                      ) : (
                        <span className="text-xs text-text-2">
                          To verify, send any email from this address to {address} with <span className="font-mono">{s.verificationCode}</span> in the subject.
                        </span>
                      )}
                    </div>
                    {s.email.toLowerCase() !== sessionUser.email?.toLowerCase() ? (
                      <form action={removeSenderAction}>
                        <input type="hidden" name="senderId" value={s.id} />
                        <Button type="submit" variant="ghost" size="icon" aria-label={`Remove ${s.email}`}>
                          ✕
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
              <AddSenderForm />
            </div>
            <form action={rotateAliasAction}>
              <Button type="submit" variant="link" className="h-11 px-0">
                Get a new forwarding address
              </Button>
            </form>
          </SectionCard>

          <SectionCard title="Newsletters" description="Every newsletter you've forwarded. Turn one off to leave it out of episodes.">
            {newsletters.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">None yet. Forward an issue to get started.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {newsletters.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 border-b border-surface-2 py-2.5 last:border-b-0">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-medium">{n.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {n.lastIssueAt ? `Last issue ${relativeTime(n.lastIssueAt)}` : n.senderEmail}
                      </span>
                    </div>
                    <PrioritySelect newsletterId={n.id} value={n.priority} name={n.displayName} />
                    <form action={toggleNewsletterAction}>
                      <input type="hidden" name="newsletterId" value={n.id} />
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={n.enabled}
                        aria-label={`Include ${n.displayName} in episodes`}
                        className={`relative flex h-11 w-14 cursor-pointer items-center`}
                      >
                        <span className={`absolute inset-x-1 h-7 rounded-full ${n.enabled ? "bg-brand" : "bg-line"}`} />
                        <span className={`absolute size-5 rounded-full bg-foreground transition-all ${n.enabled ? "left-8" : "left-2"}`} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Listen in your podcast app" description="Add this private feed once. New episodes appear on their own. Keep it to yourself.">
            <FieldRow action={<CopyButton value={feedUrl} />}>{feedUrl}</FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="secondary" className="rounded-xl">
                <a href={`podcast://${feedHost}/feed/${user.feedToken}.xml`}>Apple Podcasts</a>
              </Button>
              <Button asChild variant="secondary" className="rounded-xl">
                <a href={`pktc://subscribe/${feedHost}/feed/${user.feedToken}.xml`}>Pocket Casts</a>
              </Button>
            </div>
            <form action={rotateFeedAction}>
              <Button type="submit" variant="link" className="h-11 px-0">
                Reset feed URL (the old one stops working)
              </Button>
            </form>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="add-next" className="flex flex-col gap-2.5">
            <h2 id="add-next" className="m-0 text-base font-semibold">
              Add to your next episode
            </h2>
            <AddLinkForm />
            <div className="flex items-baseline justify-between pt-2">
              <h3 className="m-0 text-base font-semibold">Up next</h3>
              <span className="font-mono text-xs font-medium text-muted-foreground">{upNext.length} ITEMS</span>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {upNext.map(({ item, newsletter }) => (
                <li key={item.id} className="flex items-center gap-3 border-b border-surface-2 py-3">
                  <span aria-hidden="true" className="size-2 flex-none rounded-full bg-brand" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {newsletter?.displayName ?? kindLabel(item.sourceKind, item.limited)} · added {relativeTime(item.createdAt)}
                    </span>
                  </div>
                  <form action={removeItemAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <Button type="submit" variant="ghost" size="icon" aria-label="Remove from next episode" className="text-muted-foreground">
                      ✕
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>

          <SectionCard title="News" description="Optional headlines on topics you choose.">
            <NewsForm
              initial={{ optIn: user.newsOptIn, mode: user.newsMode, country: user.newsCountry, language: user.newsLanguage, topics: topics.map((t) => t.label) }}
              submitLabel="Save news settings"
              hasNewsletters
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
