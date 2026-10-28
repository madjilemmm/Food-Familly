"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

export type Tab = { href: string; label: string; icon: React.ReactNode; badge?: number };

export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  // L'onglet touché s'allume tout de suite, sans attendre la page suivante.
  const [pressed, setPressed] = useState<string | null>(null);
  useEffect(() => setPressed(null), [pathname]);

  // Précharge tous les onglets (données comprises) pour qu'ils s'ouvrent instantanément,
  // à l'arrivée sur un écran et après chaque rafraîchissement en temps réel.
  const router = useRouter();
  const hrefs = tabs.map((t) => t.href).join("|");
  useEffect(() => {
    const prefetchAll = () => {
      for (const href of hrefs.split("|")) {
        if (href !== pathname) router.prefetch(href, { kind: PrefetchKind.FULL });
      }
    };
    const idle = setTimeout(prefetchAll, 300);
    const onRefresh = () => setTimeout(prefetchAll, 1500);
    window.addEventListener("atable:refreshed", onRefresh);
    return () => {
      clearTimeout(idle);
      window.removeEventListener("atable:refreshed", onRefresh);
    };
  }, [router, pathname, hrefs]);

  // Les recettes et « Ce soir » s'ouvrent depuis l'accueil : l'onglet Ce soir reste allumé.
  const matches = (href: string, path: string) =>
    path === href || path.startsWith(`${href}/`) || (href === "/menu" && (path === "/ce-soir" || path.startsWith("/recettes")));
  const isActive = (href: string) => (pressed ? pressed === href : matches(href, pathname));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-trait bg-surface pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                prefetch={true}
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
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-petit font-semibold transition-colors active:scale-95 ${
                  active ? "text-violet" : "text-encre-douce"
                }`}
              >
                <span className="relative flex items-center justify-center px-5 py-1">
                  {/* Pastille qui glisse vers l'onglet choisi */}
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-full bg-lilas"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative">{tab.icon}</span>
                </span>
                {tab.label}
                {tab.badge ? (
                  <span className="absolute top-1 left-1/2 ml-3 min-w-5 rounded-full bg-accent px-1.5 text-center text-etiquette leading-5 font-semibold text-on-accent">
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
