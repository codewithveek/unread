/** Two-letter avatar text from a display name, falling back to the email. */
export function initialsFor(name: string | undefined, email: string | undefined): string {
  const source = name?.includes("@") ? undefined : name?.trim();
  if (source) {
    const words = source.split(/\s+/).filter(Boolean);
    const first = words[0]?.[0] ?? "";
    const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : (words[0]?.[1] ?? "");
    return (first + last).toUpperCase();
  }
  const local = email?.split("@")[0] ?? "";
  return (local.slice(0, 2) || "U").toUpperCase();
}
