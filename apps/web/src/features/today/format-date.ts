export interface EpisodeDateParts {
  /** "FRIDAY, 23 OCTOBER" — the Home eyebrow. */
  eyebrow: string;
  /** "23" — big number on the cover. */
  day: string;
  /** "OCT · FRI" — cover caption. */
  caption: string;
  /** "2026-10-23" — the episode's local date key. */
  isoDate: string;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Date labels for the user's local day, in their timezone. */
export function episodeDateParts(now: Date, timeZone: string): EpisodeDateParts {
  const long = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(now);
  const short = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    month: "short",
  }).formatToParts(now);
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return {
    eyebrow: `${part(long, "weekday")}, ${part(long, "day")} ${part(long, "month")}`.toUpperCase(),
    day: part(long, "day"),
    caption: `${part(short, "month")} · ${part(short, "weekday")}`.toUpperCase(),
    isoDate: iso,
  };
}

/** "07:00" → "7:00" for copy like "arrives every morning at 7:00". */
export function displayDeliveryTime(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, "$1");
}
