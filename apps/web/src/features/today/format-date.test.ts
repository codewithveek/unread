import { describe, expect, it } from "vitest";
import { displayDeliveryTime, episodeDateParts } from "./format-date";

describe("episodeDateParts", () => {
  // 23:30 UTC on Fri 23 Oct is already Sat 24 Oct in Lagos (UTC+1).
  const now = new Date("2026-10-23T23:30:00Z");

  it("formats in UTC", () => {
    expect(episodeDateParts(now, "UTC")).toEqual({
      eyebrow: "FRIDAY, 23 OCTOBER",
      day: "23",
      caption: "OCT · FRI",
      isoDate: "2026-10-23",
    });
  });

  it("uses the user's timezone for the local day", () => {
    const parts = episodeDateParts(now, "Africa/Lagos");
    expect(parts.eyebrow).toBe("SATURDAY, 24 OCTOBER");
    expect(parts.isoDate).toBe("2026-10-24");
  });
});

describe("displayDeliveryTime", () => {
  it("drops a leading zero on the hour", () => {
    expect(displayDeliveryTime("07:00")).toBe("7:00");
    expect(displayDeliveryTime("18:30")).toBe("18:30");
  });
});
