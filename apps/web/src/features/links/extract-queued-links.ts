import "server-only";
import { extractLinkItems } from "@unread/core/links";
import { db } from "@/lib/db";

/** Runs after the response (next/server `after`) so saving a link stays fast. */
export async function extractQueuedLinks(itemIds: string[]): Promise<void> {
  try {
    await extractLinkItems({ db: db(), itemIds });
  } catch (error) {
    console.error("link extraction failed", error);
  }
}
