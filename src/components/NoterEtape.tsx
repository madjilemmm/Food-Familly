"use client";

import { useEffect } from "react";

/** Les étapes que seul le téléphone voit (les autres se comptent côté serveur). */
export type EtapeDuTelephone = "accueil" | "liste_ouverte" | "ce_soir_affiche" | "prevenir_propose" | "ouverture_icone" | "ouverture_notification";

/** Une fois par téléphone, une fois par visite, ou une fois par jour. */
type Frequence = "telephone" | "visite" | "jour";

/** Compte une étape en silence : un total par jour, sans identifiant (voir /confidentialite). */
export function noterDepuisLeTelephone(etape: EtapeDuTelephone) {
  fetch("/api/etape", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ etape }), keepalive: true }).catch(() => {});
}

/**
 * Compte une étape, une fois par téléphone (par défaut), une fois par visite (l'accueil) ou une fois par jour. Un total par jour,
 * sans identifiant : voir /confidentialite. Si le téléphone ne garde rien, on ne compte pas.
 */
export function NoterEtape({ etape, frequence = "telephone" }: { etape: EtapeDuTelephone; frequence?: Frequence }) {
  useEffect(() => {
    const cle = `kaddie.etape.${etape}`;
    try {
      const memoire = frequence === "visite" ? sessionStorage : localStorage;
      const valeur = frequence === "jour" ? new Date().toLocaleDateString("sv-SE") : "1";
      if (memoire.getItem(cle) === valeur) return;
      memoire.setItem(cle, valeur);
    } catch {
      return;
    }
    noterDepuisLeTelephone(etape);
  }, [etape, frequence]);
  return null;
}
