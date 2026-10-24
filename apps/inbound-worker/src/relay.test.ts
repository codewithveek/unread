import { verifyInbound } from "@unread/core/inbound/signature";
import { describe, expect, it, vi } from "vitest";
import { relay, type InboundMessage } from "./relay";

function message(overrides: Partial<InboundMessage> = {}): InboundMessage & { rejected: string | null } {
  const raw = new TextEncoder().encode("Subject: hi\r\n\r\nbody");
  const m = {
    from: "lucky@example.com",
    to: "e5aksq66ta@in.getunread.site",
    raw: new Response(raw).body as ReadableStream<Uint8Array>,
    rawSize: raw.byteLength,
    rejected: null as string | null,
    setReject(reason: string) {
      m.rejected = reason;
    },
    ...overrides,
  };
  return m;
}

const env = { INBOUND_WEBHOOK_URL: "https://getunread.site/inbound/email", INBOUND_WEBHOOK_SECRET: "s" };

describe("relay", () => {
  it("signs and posts the raw message", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const ok = await verifyInbound({
        secret: "s",
        header: headers.get("x-unread-signature"),
        envelopeFrom: headers.get("x-unread-envelope-from") ?? "",
        envelopeTo: headers.get("x-unread-envelope-to") ?? "",
        body: init?.body as Uint8Array,
        nowSeconds: Math.floor(Date.now() / 1000),
      });
      return new Response(null, { status: ok ? 200 : 401 });
    });
    const m = message();
    expect(await relay(m, env, { fetchImpl: fetchImpl as typeof fetch })).toBe("relayed");
    expect(m.rejected).toBeNull();
  });

  it("rejects addresses that can't be an alias, and oversized mail", async () => {
    const bad = message({ to: "postmaster@in.getunread.site" });
    expect(await relay(bad, env)).toBe("rejected:address");
    const big = message({ rawSize: 5_000_000 });
    expect(await relay(big, env)).toBe("rejected:size");
  });

  it("retries 5xx and then soft-fails", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const m = message();
    expect(await relay(m, env, { fetchImpl: fetchImpl as typeof fetch, sleep: async () => {} })).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(m.rejected).toMatch(/Temporary/);
  });
});
