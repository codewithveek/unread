import { schema } from "@unread/db";
import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { togglePromoAction } from "@/features/admin/actions";
import { CreatePromoForm } from "@/features/admin/create-promo-form";
import { requireAdmin } from "@/features/admin/guard";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** prd §8.1/§8.3: daily cost totals per provider, and promo codes. */
export default async function AdminPage() {
  await requireAdmin();
  const [daily, codes, redemptions] = await Promise.all([
    db().execute<{ day: string; provider: string | null; episodes: number; characters: number; cents: number }>(sql`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, voice_provider as provider,
             count(*)::int as episodes, coalesce(sum(characters), 0)::int as characters, coalesce(sum(cost_cents), 0)::int as cents
      from episodes where status = 'ready' and created_at > now() - interval '14 days'
      group by 1, 2 order by 1 desc, 2`),
    db().select().from(schema.promoCodes).orderBy(desc(schema.promoCodes.createdAt)).limit(50),
    db()
      .select({ r: schema.promoRedemptions, code: schema.promoCodes.code, email: schema.users.email })
      .from(schema.promoRedemptions)
      .innerJoin(schema.promoCodes, eq(schema.promoCodes.id, schema.promoRedemptions.codeId))
      .innerJoin(schema.users, eq(schema.users.id, schema.promoRedemptions.userId))
      .orderBy(desc(schema.promoRedemptions.redeemedAt))
      .limit(30),
  ]);
  const cell = "border-b border-surface-2 px-2 py-2 text-left";

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeading eyebrow="ADMIN" title="Costs and codes" />
      <SectionCard title="Last 14 days">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[13px]">
            <thead>
              <tr className="text-muted-foreground">
                {["Day", "Voice", "Episodes", "Characters", "Est. cost"].map((h) => (
                  <th key={h} className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={`${d.day}-${d.provider}`}>
                  <td className={cell}>{d.day}</td>
                  <td className={cell}>{d.provider ?? "?"}</td>
                  <td className={cell}>{d.episodes}</td>
                  <td className={cell}>{d.characters.toLocaleString("en")}</td>
                  <td className={cell}>${(d.cents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <SectionCard title="Promo codes" description="A code grants Plus for N days, capped at a number of Studio episodes.">
        <CreatePromoForm />
        <ul className="m-0 flex list-none flex-col p-0">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-surface-2 py-2 font-mono text-[13px]">
              <span className="flex-1">
                {c.code} · {c.trialDays}d · {c.trialEpisodeLimit} eps · {c.redeemedCount}/{c.maxRedemptions ?? "∞"}
                {c.expiresAt ? ` · until ${c.expiresAt.toISOString().slice(0, 10)}` : ""} {c.note ? `· ${c.note}` : ""}
              </span>
              <form action={togglePromoAction}>
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" variant="secondary" className="h-9 px-3 text-xs">
                  {c.active ? "Deactivate" : "Activate"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard title="Recent redemptions">
        <ul className="m-0 flex list-none flex-col p-0 font-mono text-[13px]">
          {redemptions.map(({ r, code, email }) => (
            <li key={r.id} className="border-b border-surface-2 py-2">
              {code} · {email ?? r.userId} · {r.episodesUsed}/{r.episodeLimit} eps · {r.endedReason ?? `ends ${r.trialEndsAt.toISOString().slice(0, 10)}`}
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageContainer>
  );
}
