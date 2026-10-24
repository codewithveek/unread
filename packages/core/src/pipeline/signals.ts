import type { Database } from "@unread/db";
import { sql } from "drizzle-orm";
import type { SkipRates } from "./plan";

/**
 * Skip rate per source over the last 60 days, from the listening-events
 * hypertable (prd §7). Keyed by the same labels the planner sees.
 */
export async function loadSkipRates(db: Database, userId: string): Promise<SkipRates> {
  const rows = await db.execute<{ label: string; skips: number; plays: number }>(sql`
    select coalesce(n.display_name, case i.source_kind when 'news' then 'News · ' || coalesce(i.topic_label, 'Top stories') else 'Your link' end) as label,
           count(*) filter (where e.event = 'skip')::int as skips,
           count(*) filter (where e.event in ('play', 'complete', 'skip'))::int as plays
    from listening_events e
    join chapter_sources cs on cs.chapter_id = e.chapter_id and cs.role = 'primary'
    join items i on i.id = cs.item_id
    left join newsletters n on n.id = i.newsletter_id
    where e.user_id = ${userId} and e.occurred_at > now() - interval '60 days'
    group by 1`);
  return new Map(rows.filter((r) => Number(r.plays) >= 3).map((r) => [r.label, Number(r.skips) / Number(r.plays)]));
}
