"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Le fond de la barre d'état de l'iPhone (heure, batterie en blanc) :
 * transparent quand un bandeau illustré passe dessous (il monte jusqu'en haut,
 * autour de la Dynamic Island), violet au-dessus du lilas pour que le texte reste lisible.
 */
export function BarreEtat() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const barre = ref.current;
    if (!barre) return;
    let image = 0;
    const maj = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => {
        const h = barre.offsetHeight;
        if (!h) return;
        // La barre ne capte pas le doigt (pointer-events: none) : on voit ce qu'il y a dessous.
        const dessous = document.elementFromPoint(window.innerWidth / 2, h / 2);
        barre.dataset.scene = dessous?.closest(".kd-scene") ? "1" : "0";
      });
    };
    maj();
    // Après l'apparition en douceur de l'écran (et ses chargements).
    const tard = setTimeout(maj, 350);
    const encorePlusTard = setTimeout(maj, 1200);
    window.addEventListener("scroll", maj, { passive: true });
    window.addEventListener("resize", maj);
    return () => {
      cancelAnimationFrame(image);
      clearTimeout(tard);
      clearTimeout(encorePlusTard);
      window.removeEventListener("scroll", maj);
      window.removeEventListener("resize", maj);
    };
  }, [pathname]);

  return (
    <div
      ref={ref}
      aria-hidden
      data-scene="0"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-violet transition-opacity duration-200 data-[scene=1]:opacity-0"
    />
  );
}
