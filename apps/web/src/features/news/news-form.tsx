"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/features/action-state";
import { cn } from "@/lib/utils";
import { saveNewsAction } from "./actions";
import { NEWS_EDITIONS, SUGGESTED_TOPICS } from "./topics";

export interface NewsFormProps {
  initial: { optIn: boolean; mode: "always" | "fill"; country: string | null; language: string | null; topics: string[] };
  submitLabel: string;
  /** Where to go after saving (onboarding), or stay put (Sources). */
  nextHref?: string;
  hasNewsletters: boolean;
}

function detectEdition(): { country: string; language: string } {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region ?? "US";
    const edition = NEWS_EDITIONS.find((e) => e.country === region);
    return edition ? { country: edition.country, language: edition.language } : { country: "US", language: "en" };
  } catch {
    return { country: "US", language: "en" };
  }
}

const chip = (on: boolean) =>
  cn(
    "flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium",
    on ? "border-brand bg-brand/15 text-foreground" : "border-line bg-surface text-text-2 hover:bg-surface-2",
  );

/** prd §4.3: "Want us to catch you up on the news too?" Off by default. */
export function NewsForm({ initial, submitLabel, nextHref, hasNewsletters }: NewsFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveNewsAction, initialActionState);
  const [optIn, setOptIn] = useState(initial.optIn);
  const [topics, setTopics] = useState<string[]>(initial.topics);
  const [query, setQuery] = useState("");
  const [edition, setEdition] = useState(
    initial.country ? `${initial.country}:${initial.language ?? "en"}` : "",
  );

  useEffect(() => {
    if (!edition) {
      const d = detectEdition();
      setEdition(`${d.country}:${d.language}`);
    }
  }, [edition]);

  useEffect(() => {
    if (state.ok && nextHref) router.push(nextHref as Parameters<typeof router.push>[0]);
  }, [state.ok, nextHref, router]);

  const toggle = (label: string) => setTopics((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label].slice(0, 12)));
  const addCustom = () => {
    const label = query.trim();
    if (label.length >= 2 && !topics.some((t) => t.toLowerCase() === label.toLowerCase())) setTopics((t) => [...t, label].slice(0, 12));
    setQuery("");
  };
  const [country, language] = (edition || "US:en").split(":");
  const allTopics = [...new Set([...SUGGESTED_TOPICS, ...topics])];

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="newsOptIn" value={optIn ? "on" : "off"} />
      <input type="hidden" name="newsCountry" value={country} />
      <input type="hidden" name="newsLanguage" value={language} />
      {optIn ? topics.map((t) => <input key={t} type="hidden" name="topics" value={t} />) : null}

      {!hasNewsletters ? (
        <p className="m-0 rounded-[14px] border border-line bg-surface px-4 py-3 text-sm text-text-2">
          Tip: no newsletters yet? Add news and your first episode can be made right away.
        </p>
      ) : null}

      <div role="radiogroup" aria-label="Include news" className="grid grid-cols-2 gap-2">
        {[
          { value: false, label: "No thanks" },
          { value: true, label: "Yes, add news" },
        ].map((o) => (
          <button key={o.label} type="button" role="radio" aria-checked={optIn === o.value} onClick={() => setOptIn(o.value)} className={cn(chip(optIn === o.value), "justify-center rounded-xl")}>
            {o.label}
          </button>
        ))}
      </div>

      {optIn ? (
        <>
          <label className="flex h-12 items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5">
            <span className="sr-only">Search any topic</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Add any topic, team or place"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={addCustom} className="h-9 cursor-pointer rounded-lg px-3 text-sm text-link">
              Add
            </button>
          </label>
          <div role="group" aria-label="Topics" className="flex flex-wrap gap-2.5">
            {allTopics.map((label) => {
              const on = topics.includes(label);
              return (
                <button key={label} type="button" aria-pressed={on} onClick={() => toggle(label)} className={chip(on)}>
                  {on ? <span aria-hidden="true" className="text-brand">✓</span> : null}
                  {label}
                </button>
              );
            })}
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold text-text-2">When to include news</legend>
            {[
              { value: "fill", label: "Only fill quiet days", hint: "News appears when your newsletters don't fill the episode" },
              { value: "always", label: "Always include a news segment", hint: "A few headlines in every episode" },
            ].map((o) => (
              <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-line bg-surface p-3.5 has-[:checked]:border-brand">
                <input type="radio" name="newsMode" value={o.value} defaultChecked={initial.mode === o.value} className="mt-1 accent-[var(--brand)]" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium">{o.label}</span>
                  <span className="text-[13px] text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-text-2">News edition</span>
            <select
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              className="h-12 rounded-[14px] border border-line bg-surface px-3 text-[15px] text-foreground"
            >
              {NEWS_EDITIONS.map((e) => (
                <option key={e.country} value={`${e.country}:${e.language}`}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <input type="hidden" name="newsMode" value={initial.mode} />
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <p role="status" className="m-0 min-h-5 text-sm text-muted-foreground">
          {state.error ?? (nextHref ? "" : state.message) ?? ""}
        </p>
      </div>
    </form>
  );
}
