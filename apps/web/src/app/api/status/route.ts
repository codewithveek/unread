import { loadHome } from "@/features/episodes/queries";
import { inboundStatus } from "@/features/inbound/queries";
import { currentUser } from "@/features/users/current-user";

export const runtime = "nodejs";

/** Polled by onboarding (live forwarding status) and Home (episode progress). */
export async function GET() {
  const current = await currentUser();
  if (!current) return Response.json({ error: "Sign in" }, { status: 401 });
  const [inbound, home] = await Promise.all([inboundStatus(current.user.id), loadHome(current.user.id, current.user.feedToken)]);
  return Response.json(
    { inbound, episode: { inProgress: home.inProgress, failure: home.failure, latestId: home.latest?.id ?? null } },
    { headers: { "cache-control": "no-store" } },
  );
}
