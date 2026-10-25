"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-render the server page every few seconds while an episode is being made.
 * Paused while the tab is hidden; refreshes at once when it comes back.
 */
export function AutoRefresh({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (id === undefined) id = setInterval(() => router.refresh(), everyMs);
    };
    const stop = () => {
      clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        router.refresh();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, everyMs]);
  return null;
}
