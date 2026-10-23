import { describe, expect, it } from "vitest";
import { newFeedToken, newId, newInboundAlias } from "./ids";

describe("ids", () => {
  it("makes 26-char ULIDs that sort by creation", () => {
    const first = newId();
    const second = newId();
    expect(first).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(first <= second).toBe(true);
  });

  it("makes url-safe feed tokens with 192 bits", () => {
    const token = newFeedToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newFeedToken()).not.toBe(token);
  });

  it("makes lowercase aliases without look-alike characters", () => {
    const alias = newInboundAlias();
    expect(alias).toHaveLength(10);
    expect(alias).toMatch(/^[a-hjkmnp-z2-9]+$/);
  });
});
