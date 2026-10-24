/** Stored on episodes.transcript and used by the player (highlight the current line) and the feed. */
export interface TranscriptLine {
  text: string;
  startS: number;
  sourceIds: string[];
}

export interface TranscriptChapter {
  title: string;
  origin: string;
  startS: number;
  endS: number;
  lines: TranscriptLine[];
  sources: { itemId: string; label: string; title: string; url: string | null; role: "primary" | "also" }[];
}

export interface EpisodeTranscript {
  intro: TranscriptLine[];
  chapters: TranscriptChapter[];
  outro: TranscriptLine[];
}
