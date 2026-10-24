import { cn } from "@/lib/utils";

export interface EpisodeCoverProps {
  seed: string;
  day: string;
  caption: string;
  /** Dim the bars for empty or in-progress states. */
  muted?: boolean;
  className?: string;
}

/** Small deterministic PRNG so a seed always draws the same bars (mulberry32). */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPACITIES = [1, 0.55, 1, 0.35] as const;

/**
 * In-app cover, after the canvas Home card: accent bars for what's covered,
 * faint bars for the rest. The feed's PNG cover is rendered by the worker (U2).
 */
export function EpisodeCover({ seed, day, caption, muted = false, className }: EpisodeCoverProps) {
  const random = seededRandom(seed);
  const bars = Array.from({ length: 17 }, (_, i) => {
    const accent = i < 10;
    // Faint bars sit under the date label, so they stay below its baseline.
    const height = 28 + Math.round(random() * (accent ? 80 : 52));
    return { x: 18 + i * 18, height, accent, opacity: OPACITIES[i % OPACITIES.length] ?? 1 };
  });

  return (
    <svg
      role="img"
      aria-label={`Cover for ${day} ${caption}`}
      viewBox="0 0 342 168"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-auto w-full", className)}
    >
      <rect width="342" height="168" fill="var(--surface-2)" />
      {bars.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={148 - bar.height}
          width="10"
          height={bar.height}
          rx="5"
          fill={bar.accent ? "var(--brand)" : "var(--text)"}
          opacity={bar.accent ? (muted ? bar.opacity * 0.3 : bar.opacity) : 0.14}
        />
      ))}
      <text
        x="320"
        y="44"
        textAnchor="end"
        fill="var(--text)"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontSize="40"
        fontWeight="700"
        letterSpacing="-1.5"
      >
        {day}
      </text>
      <text x="320" y="64" textAnchor="end" fill="var(--muted-text)" fontFamily="var(--font-geist-mono), monospace" fontSize="11">
        {caption}
      </text>
    </svg>
  );
}
