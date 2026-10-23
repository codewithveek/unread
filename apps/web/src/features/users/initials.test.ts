import { describe, expect, it } from "vitest";
import { initialsFor } from "./initials";

describe("initialsFor", () => {
  it("uses first and last name", () => {
    expect(initialsFor("Lucky Victory", "x@y.z")).toBe("LV");
    expect(initialsFor("Ada B. Lovelace", undefined)).toBe("AL");
  });

  it("uses the first two letters of a single name", () => {
    expect(initialsFor("lucky", undefined)).toBe("LU");
  });

  it("falls back to the email when the name is an email", () => {
    expect(initialsFor("veek@example.com", "veek@example.com")).toBe("VE");
  });

  it("never returns empty", () => {
    expect(initialsFor(undefined, undefined)).toBe("U");
  });
});
