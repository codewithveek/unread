/** Free-plan voices (prd §8: four curated; the last two are placeholders until listening tests). */
export const KOKORO_FREE_VOICES = [
  { id: "af_heart", label: "Heart", accent: "American" },
  { id: "af_bella", label: "Bella", accent: "American" },
  { id: "am_michael", label: "Michael", accent: "American" },
  { id: "bf_emma", label: "Emma", accent: "British" },
] as const;

export type KokoroVoiceId = (typeof KOKORO_FREE_VOICES)[number]["id"];
