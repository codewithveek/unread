"use client";

import type { StudioVoice } from "@unread/core/voice/elevenlabs";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/features/action-state";
import { cn } from "@/lib/utils";
import { updateVoiceAction } from "./actions";

/** Plus: pick from the ElevenLabs library (their own preview clips) and Flash vs Studio quality. */
export function StudioVoiceForm({
  voices,
  selected,
  quality,
  canUseStudio,
}: {
  voices: StudioVoice[];
  selected: string;
  quality: "flash" | "studio";
  canUseStudio: boolean;
}) {
  const [state, action, pending] = useActionState(updateVoiceAction, initialActionState);
  const [voice, setVoice] = useState(selected);
  const [query, setQuery] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const shown = voices.filter((v) => `${v.name} ${v.description}`.toLowerCase().includes(query.toLowerCase())).slice(0, 40);

  const preview = (url: string | null) => {
    audio.current?.pause();
    if (!url) return;
    audio.current = new Audio(url);
    void audio.current.play();
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="elevenlabsVoiceId" value={voice} />
      <fieldset className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
        <legend className="mb-2 text-[13px] font-semibold text-text-2">Quality</legend>
        {(["flash", "studio"] as const).map((q) => (
          <label key={q} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-surface px-3 text-sm has-[:checked]:border-brand", !canUseStudio && q === "studio" && "cursor-not-allowed opacity-60")}>
            <input type="radio" name="voiceQuality" value={q} defaultChecked={quality === q} disabled={!canUseStudio && q === "studio"} className="accent-[var(--brand)]" />
            {q === "flash" ? "Standard" : `Studio${canUseStudio ? "" : " · paid Plus"}`}
          </label>
        ))}
      </fieldset>
      <label className="flex h-11 items-center rounded-xl border border-line bg-ground px-3">
        <span className="sr-only">Search voices</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search voices" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      </label>
      <ul className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0" aria-label="Studio voices">
        {shown.map((v) => (
          <li key={v.id} className={cn("flex items-center gap-2 rounded-xl border bg-surface p-1.5 pl-3", voice === v.id ? "border-brand bg-brand/10" : "border-line")}>
            <button type="button" onClick={() => setVoice(v.id)} aria-pressed={voice === v.id} className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center text-left">
              <span className="truncate text-[15px] font-medium">{v.name}</span>
              {v.description ? <span className="truncate text-xs text-muted-foreground">{v.description}</span> : null}
            </button>
            {v.previewUrl ? (
              <button type="button" onClick={() => preview(v.previewUrl)} aria-label={`Play ${v.name} preview`} className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-line text-sm">
                ▶
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        Save Studio voice
      </Button>
      <p role="status" className={`m-0 min-h-5 text-sm ${state.error ? "text-destructive" : "text-muted-foreground"}`}>
        {state.error ?? state.message ?? ""}
      </p>
    </form>
  );
}

/** Free: hear the same intro in a Studio voice before upgrading (prd §8.1). */
export function StudioPreviewButton({ voiceId }: { voiceId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  const play = async () => {
    if (state === "playing") {
      audio.current?.pause();
      setState("idle");
      return;
    }
    setState("loading");
    const a = new Audio(`/voice-preview/${voiceId}`);
    audio.current = a;
    a.onended = () => setState("idle");
    a.onerror = () => setState("error");
    try {
      await a.play();
      setState("playing");
    } catch {
      setState("error");
    }
  };
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" onClick={play}>
        {state === "playing" ? "Stop" : state === "loading" ? "Loading…" : "Hear a Studio voice"}
      </Button>
      {state === "error" ? <span className="text-sm text-muted-foreground">Preview unavailable right now.</span> : null}
    </div>
  );
}
