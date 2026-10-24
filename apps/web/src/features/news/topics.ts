/** Global suggestions (P5: no location assumptions; local topics only if the user adds them). */
export const SUGGESTED_TOPICS = [
  "AI",
  "Startups",
  "Climate",
  "Markets",
  "Science",
  "Health",
  "Design",
  "Space",
  "Crypto",
  "Gaming",
  "Football",
  "World news",
] as const;

export const NEWS_EDITIONS = [
  { country: "US", language: "en", label: "United States · English" },
  { country: "GB", language: "en", label: "United Kingdom · English" },
  { country: "NG", language: "en", label: "Nigeria · English" },
  { country: "KE", language: "en", label: "Kenya · English" },
  { country: "ZA", language: "en", label: "South Africa · English" },
  { country: "GH", language: "en", label: "Ghana · English" },
  { country: "IN", language: "en", label: "India · English" },
  { country: "CA", language: "en", label: "Canada · English" },
  { country: "AU", language: "en", label: "Australia · English" },
  { country: "IE", language: "en", label: "Ireland · English" },
  { country: "DE", language: "de", label: "Germany · Deutsch" },
  { country: "FR", language: "fr", label: "France · Français" },
  { country: "ES", language: "es", label: "Spain · Español" },
  { country: "BR", language: "pt", label: "Brazil · Português" },
] as const;
