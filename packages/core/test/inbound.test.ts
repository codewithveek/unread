import { describe, expect, it } from "vitest";
import {
  aliasFromAddress,
  authVerdictFor,
  detectBareLinks,
  detectForwardingConfirmation,
  detectNewsletter,
  forwarderCandidates,
  htmlToBlocks,
  parseEmail,
  signInbound,
  splitIntoItems,
  textToBlocks,
  verifyInbound,
} from "../src/inbound";
import { fixture } from "./helpers";

const parse = (name: string) => parseEmail(fixture(`email/${name}`), "fallback");

describe("addresses", () => {
  it("extracts the alias and ignores plus tags", () => {
    expect(aliasFromAddress("E5aksq66ta+links@in.getunread.site", "in.getunread.site")).toBe("e5aksq66ta");
    expect(aliasFromAddress("e5aksq66ta@other.site", "in.getunread.site")).toBeNull();
    expect(aliasFromAddress("short@in.getunread.site", "in.getunread.site")).toBeNull();
  });
});

describe("signature", () => {
  const body = new TextEncoder().encode("raw mime");
  const envelope = { envelopeFrom: "a@b.com", envelopeTo: "x@in.getunread.site", body };

  it("verifies its own signature and rejects tampering or staleness", async () => {
    const header = await signInbound({ secret: "s3cret", timestamp: 1_000, ...envelope });
    expect(await verifyInbound({ secret: "s3cret", header, nowSeconds: 1_100, ...envelope })).toBe(true);
    expect(await verifyInbound({ secret: "wrong", header, nowSeconds: 1_100, ...envelope })).toBe(false);
    expect(await verifyInbound({ secret: "s3cret", header, nowSeconds: 2_000, ...envelope })).toBe(false);
    expect(
      await verifyInbound({ secret: "s3cret", header, nowSeconds: 1_100, ...envelope, envelopeFrom: "evil@b.com" }),
    ).toBe(false);
  });
});

describe("gmail forwarding confirmation", () => {
  it("finds the code, the confirm link and the requester", async () => {
    const email = await parse("gmail-confirmation.eml");
    expect(detectForwardingConfirmation(email)).toEqual({
      provider: "gmail",
      code: "123456789",
      url: "https://mail-settings.google.com/mail/vf-%5BANGjdJ_abc%5D-xyz123",
      requester: "lucky@example.com",
    });
    expect(authVerdictFor(email, "forwarding-noreply@google.com")).toBe("pass");
  });
});

describe("auto-forwarded HTML newsletter", () => {
  it("identifies the newsletter and the forwarder", async () => {
    const email = await parse("newsletter-autoforward.eml");
    expect(forwarderCandidates(email, "lucky@example.com")).toEqual(["lucky@example.com"]);
    expect(authVerdictFor(email, "lucky@example.com")).toBe("pass");
    expect(detectNewsletter(email, ["lucky@example.com"])).toMatchObject({
      senderEmail: "crew@morningbrew.com",
      displayName: "Morning Brew",
    });
    expect(detectBareLinks(email)).toBeNull();
  });

  it("splits stories and drops sponsor, footer, preheader and tracking", async () => {
    const email = await parse("newsletter-autoforward.eml");
    const items = splitIntoItems(htmlToBlocks(email.html ?? ""));
    expect(items.map((i) => i.title)).toEqual([
      "OpenAI ships a cheaper reasoning model",
      "The Fed holds rates steady",
      "Quick hits",
    ]);
    const all = items.map((i) => i.text).join("\n");
    expect(all).not.toMatch(/Acme Bank|Unsubscribe|Preheader|Share the Brew|Copyright/);
    expect(all).toContain("$2 per million input tokens");
    expect(items[0]?.links).toEqual([{ text: "Read the announcement", url: "https://openai.com/blog/new-model" }]);
    expect(items[2]?.text).toContain("- Spotify raised prices");
  });
});

describe("manual forward (plain text)", () => {
  it("finds the original newsletter and strips the forward header", async () => {
    const email = await parse("newsletter-manual-forward.eml");
    expect(detectNewsletter(email, ["lucky@example.com"])).toMatchObject({
      senderEmail: "news@thehustle.co",
      displayName: "The Hustle",
      subject: "OpenAI's price cut",
    });
    const items = splitIntoItems(textToBlocks(email.text ?? ""));
    expect(items.map((i) => i.title)).toEqual(["OpenAI cuts the price of reasoning", "Why bakeries love subscriptions"]);
    expect(items.map((i) => i.text).join(" ")).not.toMatch(/Forwarded message|Unsubscribe/);
  });
});

describe("bare links and spoofing", () => {
  it("treats a short message with a URL as a link save", async () => {
    expect(detectBareLinks(await parse("bare-link.eml"))).toEqual(["https://example.org/long-read-on-sleep"]);
  });

  it("fails auth when SPF fails and DKIM is missing", async () => {
    expect(authVerdictFor(await parse("spoofed.eml"), "lucky@example.com")).toBe("fail");
  });
});
