"use client";

import { useEffect } from "react";

/**
 * Compte une étape du début, une fois par téléphone (l'accueil : une fois par visite). Un total par jour, sans
 * identifiant : voir /confidentialite. Si le téléphone ne garde rien, on ne compte pas.
 */
export function NoterEtape({ etape, parVisite = false }: { etape: "accueil" | "liste_ouverte"; parVisite?: boolean }) {
  useEffect(() => {
    const cle = `kaddie.etape.${etape}`;
    try {
      const memoire = parVisite ? sessionStorage : localStorage;
      if (memoire.getItem(cle)) return;
      memoire.setItem(cle, "1");
    } catch {
      return;
    }
    fetch("/api/etape", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ etape }), keepalive: true }).catch(() => {});
  }, [etape, parVisite]);
  return null;
}
