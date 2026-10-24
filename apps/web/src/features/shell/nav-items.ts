import type { Route } from "next";
import type { ComponentType, SVGProps } from "react";
import { SettingsIcon, SourcesIcon, TodayIcon } from "./nav-icons";

export interface NavItem {
  href: Route;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today", Icon: TodayIcon },
  { href: "/sources", label: "Sources", Icon: SourcesIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
