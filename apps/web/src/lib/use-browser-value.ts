"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/** A value only the browser knows (timezone, locale); `fallback` during SSR and hydration. */
export function useBrowserValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => fallback);
}
