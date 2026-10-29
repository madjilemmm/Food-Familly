"use client";

import { useEffect } from "react";
import { noterDepuisLeTelephone } from "@/components/NoterEtape";

/**
 * Compte comment Kaddie vient d'être ouverte, pour savoir si l'on revient et par où : une notification (son lien porte
 * « ?via=notification », retiré de l'adresse aussitôt) ou l'icône de l'écran d'accueil (une fois par visite). Un lien
 * partagé se compte côté serveur. Un total par jour, sans identifiant : voir /confidentialite.
 */
export function NoterOuverture() {
  useEffect(() => {
    try {
      const adresse = new URL(window.location.href);
      if (adresse.searchParams.get("via") === "notification") {
        adresse.searchParams.delete("via");
        window.history.replaceState(window.history.state, "", `${adresse.pathname}${adresse.search}${adresse.hash}`);
        noterDepuisLeTelephone("ouverture_notification");
        return;
      }
      const installee = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!installee || sessionStorage.getItem("kaddie.ouverture")) return;
      sessionStorage.setItem("kaddie.ouverture", "1");
      noterDepuisLeTelephone("ouverture_icone");
    } catch {
      // Compter ne doit jamais gêner : sans mémoire sur le téléphone, on ne compte pas.
    }
  }, []);
  return null;
}
