"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface EpisodePrefsFieldsProps {
  isPlus: boolean;
  initial: { episodeMinutes: number; deliveryTime: string; timezone: string; cadence: "daily" | "weekly"; weeklyDay: number };
  /** Fill the timezone from the browser (first run). */
  detectTimezone?: boolean;
}

/** Length, cadence, day and delivery time; Free is weekly and ≤ 10 min (prd §8). */
export function EpisodePrefsFields({ isPlus, initial, detectTimezone = false }: EpisodePrefsFieldsProps) {
  const [minutes, setMinutes] = useState(initial.episodeMinutes);
  const [cadence, setCadence] = useState(isPlus ? initial.cadence : "weekly");
  const [timezone, setTimezone] = useState(initial.timezone);

  useEffect(() => {
    if (detectTimezone) {
      try {
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || initial.timezone);
      } catch {
        // keep the stored one
      }
    }
  }, [detectTimezone, initial.timezone]);

  const option = (on: boolean, disabled = false) =>
    cn(
      "h-11 rounded-xl border text-sm font-medium",
      disabled ? "cursor-not-allowed border-line text-muted-foreground opacity-60" : "cursor-pointer",
      on ? "border-brand bg-brand/15 font-semibold text-foreground" : "border-line bg-surface text-text-2",
    );

  return (
    <div className="flex flex-col gap-5">
      <input type="hidden" name="episodeMinutes" value={minutes} />
      <input type="hidden" name="cadence" value={cadence} />
      <input type="hidden" name="timezone" value={timezone} />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-text-2">Episode length</span>
        <div role="radiogroup" aria-label="Episode length" className="grid grid-cols-3 gap-2">
          {[5, 10, 20].map((m) => {
            const locked = !isPlus && m > 10;
            return (
              <button key={m} type="button" role="radio" aria-checked={minutes === m} disabled={locked} onClick={() => setMinutes(m)} className={option(minutes === m, locked)}>
                {m} min{locked ? " · Plus" : ""}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-text-2">How often</span>
        <div role="radiogroup" aria-label="How often" className="grid grid-cols-2 gap-2">
          <button type="button" role="radio" aria-checked={cadence === "weekly"} onClick={() => setCadence("weekly")} className={option(cadence === "weekly")}>
            Weekly digest
          </button>
          <button type="button" role="radio" aria-checked={cadence === "daily"} disabled={!isPlus} onClick={() => setCadence("daily")} className={option(cadence === "daily", !isPlus)}>
            Daily{isPlus ? "" : " · Plus"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cadence === "weekly" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-text-2">Day</span>
            <select name="weeklyDay" defaultValue={initial.weeklyDay} className="h-12 rounded-xl border border-line bg-surface px-3 text-[15px] text-foreground">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="weeklyDay" value={initial.weeklyDay} />
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-text-2">Delivery time</span>
          <input type="time" name="deliveryTime" defaultValue={initial.deliveryTime} required className="h-12 rounded-xl border border-line bg-surface px-3 text-[15px] text-foreground [color-scheme:dark]" />
        </label>
      </div>
      <p className="m-0 text-[13px] text-muted-foreground">Times are in {timezone.replace(/_/g, " ")}. Episodes are only made when there's something new.</p>
    </div>
  );
}
