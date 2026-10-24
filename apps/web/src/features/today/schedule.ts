import type { Cadence } from "@unread/db";
import { displayDeliveryTime } from "./format-date";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export interface DeliverySchedule {
  cadence: Cadence;
  /** 0 = Sunday … 6 = Saturday. */
  weeklyDay: number;
  /** `HH:mm`, local. */
  deliveryTime: string;
}

/** "every Monday at 7:00" or "each morning at 7:00". */
export function deliveryScheduleText({ cadence, weeklyDay, deliveryTime }: DeliverySchedule): string {
  const time = displayDeliveryTime(deliveryTime);
  if (cadence === "daily") return `each morning at ${time}`;
  return `every ${WEEKDAYS[weeklyDay] ?? "Monday"} at ${time}`;
}
