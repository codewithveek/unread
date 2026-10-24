import type { ParsedEmail } from "./parse";

export interface ForwardingConfirmation {
  provider: "gmail";
  code: string | null;
  url: string | null;
  /** The address asking to forward, when the email names it. */
  requester: string | null;
}

const GMAIL_SENDER = "forwarding-noreply@google.com";

/**
 * Gmail sends this before an auto-forward rule works (prd §4.1). Subject looks
 * like "(#123456789) Gmail Forwarding Confirmation - Receive Mail from x@gmail.com".
 */
export function detectForwardingConfirmation(email: ParsedEmail): ForwardingConfirmation | null {
  const isGmail =
    email.from.address === GMAIL_SENDER && /forwarding confirmation/i.test(email.subject);
  if (!isGmail) return null;
  const body = `${email.subject}\n${email.text ?? ""}\n${email.html ?? ""}`;
  const code =
    body.match(/confirmation code:\s*(\d{6,12})/i)?.[1] ?? email.subject.match(/\(#(\d{6,12})\)/)?.[1] ?? null;
  const url = body.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/vf-[^\s"'<>]+/i)?.[0] ?? null;
  const requester =
    email.subject.match(/receive mail from\s+([\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+)/i)?.[1]?.toLowerCase() ?? null;
  return { provider: "gmail", code, url: url?.replace(/&amp;/g, "&") ?? null, requester };
}

export function isFromGmailForwarding(email: ParsedEmail): boolean {
  return email.from.address === GMAIL_SENDER;
}
