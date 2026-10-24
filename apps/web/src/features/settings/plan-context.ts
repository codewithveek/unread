import "server-only";
import { loadPlanContext } from "@unread/core/plans";
import { cache } from "react";
import { db } from "@/lib/db";

/** Effective plan for the signed-in user, once per request. */
export const planContextFor = cache((userId: string) => loadPlanContext({ db: db(), userId, now: new Date() }));
