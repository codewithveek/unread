import type { Route } from "next";
import type { ComponentType, SVGProps } from "react";
import { SettingsIcon, SourcesIcon, TodayIcon, TopicsIcon } from "./nav-icons";

export interface NavItem {
  href: Route;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Shown in the phone/tablet tab bar as well as the desktop sidebar. */
  inTabBar: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today", Icon: TodayIcon, inTabBar: true },
  { href: "/topics", label: "Topics", Icon: TopicsIcon, inTabBar: true },
  { href: "/sources", label: "Sources", Icon: SourcesIcon, inTabBar: true },
  { href: "/settings", label: "Settings", Icon: SettingsIcon, inTabBar: false },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
