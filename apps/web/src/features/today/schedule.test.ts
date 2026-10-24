import { describe, expect, it } from "vitest";
import { deliveryScheduleText } from "./schedule";

describe("deliveryScheduleText", () => {
  it("describes the weekly digest", () => {
    expect(deliveryScheduleText({ cadence: "weekly", weeklyDay: 1, deliveryTime: "07:00" })).toBe(
      "every Monday at 7:00",
    );
    expect(deliveryScheduleText({ cadence: "weekly", weeklyDay: 0, deliveryTime: "18:30" })).toBe(
      "every Sunday at 18:30",
    );
  });

  it("describes daily delivery", () => {
    expect(deliveryScheduleText({ cadence: "daily", weeklyDay: 1, deliveryTime: "06:15" })).toBe(
      "each morning at 6:15",
    );
  });
});
