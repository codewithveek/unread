"use client";

import { KOKORO_FREE_VOICES } from "@unread/core/voice/voices";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Free voices with a short preview each (prd §8: Kokoro, 4 curated voices). */
export function KokoroVoicePicker({ name = "kokoroVoiceId", defaultValue }: { name?: string; defaultValue: string }) {
  const [selected, setSelected] = useState(defaultValue);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const preview = (id: string) => {
    audio.current?.pause();
    if (previewing === id) {
      setPreviewing(null);
      return;
    }
    const a = new Audio(`/voices/${id}.mp3`);
    audio.current = a;
    a.onended = () => setPreviewing(null);
    void a.play();
    setPreviewing(id);
  };

  return (
    <fieldset className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
      <legend className="sr-only">Voice</legend>
      {KOKORO_FREE_VOICES.map((v) => (
        <div key={v.id} className={cn("flex items-center gap-2 rounded-xl border bg-surface p-2 pl-3", selected === v.id ? "border-brand bg-brand/10" : "border-line")}>
          <label className="flex min-w-0 flex-1 cursor-pointer flex-col">
            <input type="radio" name={name} value={v.id} checked={selected === v.id} onChange={() => setSelected(v.id)} className="sr-only" />
            <span className="text-[15px] font-medium">{v.label}</span>
            <span className="text-xs text-muted-foreground">{v.accent}</span>
          </label>
          <button
            type="button"
            onClick={() => preview(v.id)}
            aria-label={`${previewing === v.id ? "Stop" : "Play"} ${v.label} preview`}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-line text-sm"
          >
            {previewing === v.id ? "■" : "▶"}
          </button>
        </div>
      ))}
    </fieldset>
  );
}
