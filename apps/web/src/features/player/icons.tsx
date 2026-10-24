import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", "aria-hidden": true } as const;

export function PlayIcon(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon(props: P) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function PrevIcon(props: P) {
  return (
    <svg {...base} {...stroke} {...props}>
      <path d="M6 5v14" />
      <path d="M19 5l-10 7 10 7z" fill="currentColor" />
    </svg>
  );
}

export function NextIcon(props: P) {
  return (
    <svg {...base} {...stroke} {...props}>
      <path d="M18 5v14" />
      <path d="M5 5l10 7-10 7z" fill="currentColor" />
    </svg>
  );
}

export function ChevronDownIcon(props: P) {
  return (
    <svg {...base} {...stroke} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function LinkIcon(props: P) {
  return (
    <svg {...base} {...stroke} {...props}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}

export function Back15Icon(props: P) {
  return (
    <svg {...base} {...stroke} {...props}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4h4" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontFamily="var(--font-geist-mono)">
        15
      </text>
    </svg>
  );
}

export function Forward15Icon(props: P) {
  return (
    <svg {...base} {...stroke} {...props}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v4h-4" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontFamily="var(--font-geist-mono)">
        15
      </text>
    </svg>
  );
}
