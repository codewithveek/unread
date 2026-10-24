import { domainOf } from "./address";
import type { ParsedEmail } from "./parse";

export type AuthVerdict = "pass" | "fail" | "none";

interface MethodResult {
  method: "spf" | "dkim" | "dmarc";
  result: string;
  domain: string | null;
}

/** Parse `Authentication-Results` style headers (RFC 8601), including ARC copies. */
export function parseAuthResults(values: string[]): MethodResult[] {
  const results: MethodResult[] = [];
  for (const value of values) {
    for (const match of value.matchAll(/\b(spf|dkim|dmarc)=(\w+)([^;]*)/gi)) {
      const method = match[1]?.toLowerCase() as MethodResult["method"];
      const props = match[3] ?? "";
      const domainProp =
        props.match(/header\.d=([\w.-]+)/i)?.[1] ??
        props.match(/header\.from=([\w.-]+)/i)?.[1] ??
        props.match(/smtp\.mailfrom=(?:[^@\s;]+@)?([\w.-]+)/i)?.[1] ??
        null;
      results.push({ method, result: (match[2] ?? "").toLowerCase(), domain: domainProp?.toLowerCase() ?? null });
    }
  }
  return results;
}

function aligned(domain: string | null, expected: string): boolean {
  if (!domain) return false;
  return domain === expected || domain.endsWith(`.${expected}`) || expected.endsWith(`.${domain}`);
}

/**
 * Did the mail really come from `address`'s domain? Pass when SPF or DKIM
 * passed for that domain (prd §4.1, §10). `none` means no verdict headers.
 */
export function authVerdictFor(email: ParsedEmail, address: string): AuthVerdict {
  const values = [
    ...(email.headers.get("authentication-results") ?? []),
    ...(email.headers.get("arc-authentication-results") ?? []),
  ];
  const results = parseAuthResults(values);
  const receivedSpf = email.headers.get("received-spf") ?? [];
  if (results.length === 0 && receivedSpf.length === 0) return "none";
  const expected = domainOf(address);
  const passed = results.some(
    (r) => (r.method === "spf" || r.method === "dkim") && r.result === "pass" && aligned(r.domain, expected),
  );
  const spfHeaderPass = receivedSpf.some(
    (v) => /^\s*pass\b/i.test(v) && new RegExp(`@${expected.replace(/\./g, "\\.")}\\b`, "i").test(v),
  );
  return passed || spfHeaderPass ? "pass" : "fail";
}
