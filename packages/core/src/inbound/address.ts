/** Inbound aliases are 10 chars from the newInboundAlias alphabet; plus-addressing is ignored. */
export const ALIAS_PATTERN = /^[a-hjkmnp-z2-9]{10}$/;

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** `abc123defg+news@in.getunread.site` → `abc123defg`, or null if it isn't one of ours. */
export function aliasFromAddress(address: string, inboundDomain: string): string | null {
  const [local, domain] = normalizeAddress(address).split("@");
  if (!local || domain !== inboundDomain.toLowerCase()) return null;
  const alias = local.split("+")[0] ?? "";
  return ALIAS_PATTERN.test(alias) ? alias : null;
}

export function domainOf(address: string): string {
  return normalizeAddress(address).split("@")[1] ?? "";
}

/** Extract bare addresses from a header value such as `Jane <jane@x.com>, bob@y.com`. */
export function addressesIn(headerValue: string | null | undefined): string[] {
  if (!headerValue) return [];
  return Array.from(headerValue.matchAll(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g), (m) =>
    normalizeAddress(m[0]),
  );
}
