"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string; icon: string; badge?: number };

export function TabBar({ tabs, variant }: { tabs: Tab[]; variant: "parent" | "child" }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === tabs[0].href ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const big = variant === "parent";
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 pt-2 ${big ? "pb-1 text-base" : "pb-0.5 text-xs"} font-semibold transition-colors ${
                  active ? (big ? "text-tomato-600" : "text-fuchsia-600") : "text-stone-400"
                }`}
              >
                <span className={`${big ? "text-3xl" : "text-2xl"} transition-transform ${active ? "scale-110" : ""}`}>
                  {tab.icon}
                </span>
                {tab.label}
                {tab.badge ? (
                  <span className="absolute top-1 left-1/2 ml-3 min-w-5 rounded-full bg-tomato-500 px-1.5 text-center text-xs leading-5 text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
