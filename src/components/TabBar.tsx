"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string; icon: string; badge?: number };

export function TabBar({ tabs, variant }: { tabs: Tab[]; variant: "parent" | "child" }) {
  const pathname = usePathname();
  // L'onglet touché s'allume tout de suite, sans attendre la page suivante.
  const [pressed, setPressed] = useState<string | null>(null);
  useEffect(() => setPressed(null), [pathname]);

  const matches = (href: string, path: string) =>
    href === tabs[0].href ? path === href : path === href || path.startsWith(`${href}/`);
  const isActive = (href: string) => (pressed ? pressed === href : matches(href, pathname));

  const big = variant === "parent";
  const accent = big ? "text-tomato-600" : "text-fuchsia-600";
  const pill = big ? "bg-tomato-50" : "bg-fuchsia-50";

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/90 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  // Retoucher l'onglet de la page affichée : retour en haut, en douceur.
                  if (matches(tab.href, pathname) && pathname === tab.href) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                  }
                  setPressed(tab.href);
                }}
                className={`relative flex flex-col items-center gap-0.5 pt-1.5 ${big ? "pb-1 text-base" : "pb-0.5 text-xs"} font-semibold transition-colors active:scale-95 ${
                  active ? accent : "text-stone-400"
                }`}
              >
                <span
                  className={`flex items-center justify-center rounded-full px-4 py-0.5 transition-all duration-200 ${
                    big ? "text-3xl" : "text-2xl"
                  } ${active ? `${pill} scale-105` : "grayscale-[35%]"}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
                {tab.badge ? (
                  <span className="absolute top-0.5 left-1/2 ml-3 min-w-5 rounded-full bg-tomato-500 px-1.5 text-center text-xs leading-5 text-white shadow">
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
