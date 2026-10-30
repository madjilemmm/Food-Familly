"use client";

import { useEffect, useRef } from "react";
import { ARRIVEE_CLE } from "@/components/BoutonCommande";

/**
 * Juste après « Ce sera ça » : la ligne « N articles dans le caddie » se pose, puis le compteur de l'onglet Caddie marque le coup.
 * Le plat retenu a été gardé par BoutonCommande ; rien ne se rejoue en revenant sur l'écran plus tard. Animations coupées si le
 * téléphone demande moins de mouvement (design-system/styles/kaddie.css).
 */
export function CaddieArrive({ recipeId, children }: { recipeId: string; children: React.ReactNode }) {
  const ligne = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let attendu: string | null = null;
    try {
      attendu = sessionStorage.getItem(ARRIVEE_CLE);
      if (attendu === recipeId) sessionStorage.removeItem(ARRIVEE_CLE);
    } catch {
      return;
    }
    if (attendu !== recipeId) return;
    ligne.current?.firstElementChild?.classList.add("kd-arrivee");
    document.querySelector("[data-pastille='Caddie']")?.classList.add("kd-tick");
  }, [recipeId]);
  return (
    <div ref={ligne}>
      {children}
    </div>
  );
}
