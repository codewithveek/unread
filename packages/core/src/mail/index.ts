import type { CoreConfig } from "../config";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Resend's REST API (ADR 0009); without a key, mail is logged instead of sent. */
export function mailerFromConfig(config: CoreConfig, fetchImpl: typeof fetch = fetch): Mailer {
  const key = config.env.RESEND_API_KEY;
  if (!key) {
    return {
      async send(message) {
        console.log(JSON.stringify({ event: "mail.skipped", to: message.to, subject: message.subject }));
      },
    };
  }
  return {
    async send(message) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: config.env.MAIL_FROM, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      });
      if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
    },
  };
}
