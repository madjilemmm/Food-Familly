"use client";

import { useEffect, useState } from "react";
import { addItems, setItemsChecked } from "@/app/actions/list";
import { swipe } from "@/app/actions/swipes";
import { definirHorsLigne, ENVOYER, lireAttente, marquerEnvoyees, oublierEnvoyees, retirerDeLAttente, type Entree } from "@/lib/attente";
import { estErreurReseau } from "@/lib/reseau";

/** Tant qu'il reste quelque chose à envoyer, on réessaie régulièrement. */
const REESSAI_MS = 15_000;

/**
 * Envoie la file d'attente du téléphone (lib/attente) : tout de suite après une action,
 * au retour du réseau, au retour dans l'appli, et toutes les 15 s s'il reste quelque chose.
 * Les ajouts partent avant les coches (on peut cocher un article ajouté hors connexion).
 * Si le serveur refuse (course terminée entre-temps…), l'opération est abandonnée et on le dit.
 */
export function FileAttente() {
  const [refus, setRefus] = useState(false);

  useEffect(() => {
    let enCours = false;
    let relance = false;

    const lot = async (entrees: Entree[], envoi: () => Promise<unknown>) => {
      if (entrees.length === 0) return true;
      try {
        await envoi();
        marquerEnvoyees(entrees.map((e) => e.cle));
        definirHorsLigne(false);
        return true;
      } catch (e) {
        if (estErreurReseau(e)) {
          definirHorsLigne(true);
          return false;
        }
        // Refusé par le serveur : réessayer ne servirait à rien.
        retirerDeLAttente(entrees.map((x) => x.cle));
        setRefus(true);
        return true;
      }
    };

    const envoyer = async () => {
      if (enCours) {
        relance = true;
        return;
      }
      enCours = true;
      try {
        do {
          relance = false;
          const aEnvoyer = lireAttente().filter((e) => !e.envoyee);
          const ajouts = aEnvoyer.filter((e): e is Entree & { sorte: "ajouter" } => e.sorte === "ajouter");
          const coches = aEnvoyer.filter((e): e is Entree & { sorte: "cocher" } => e.sorte === "cocher");
          const swipes = aEnvoyer.filter((e): e is Entree & { sorte: "swipe" } => e.sorte === "swipe");
          // Par source (demandé / à la main), pour garder l'origine de chaque article.
          for (const source of ["manual", "request"] as const) {
            const ceux = ajouts.filter((a) => a.source === source);
            if (!(await lot(ceux, () => addItems(ceux.map((a) => ({ id: a.id, texte: a.texte })), source)))) return;
          }
          if (!(await lot(coches, () => setItemsChecked(coches.map((c) => ({ id: c.id, checked: c.checked })))))) return;
          for (const s of swipes) if (!(await lot([s], () => swipe(s.recipeId, s.liked)))) return;
        } while (relance);
      } finally {
        enCours = false;
        setTimeout(oublierEnvoyees, 9000);
      }
    };

    const auPremierPlan = () => document.visibilityState === "visible" && envoyer();
    window.addEventListener(ENVOYER, envoyer);
    window.addEventListener("online", envoyer);
    document.addEventListener("visibilitychange", auPremierPlan);
    const interval = setInterval(() => lireAttente().some((e) => !e.envoyee) && envoyer(), REESSAI_MS);
    oublierEnvoyees();
    envoyer();
    return () => {
      window.removeEventListener(ENVOYER, envoyer);
      window.removeEventListener("online", envoyer);
      document.removeEventListener("visibilitychange", auPremierPlan);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!refus) return;
    const t = setTimeout(() => setRefus(false), 6000);
    return () => clearTimeout(t);
  }, [refus]);

  return refus ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+max(env(safe-area-inset-bottom),0.75rem))] z-40 px-4">
      <p role="alert" className="kd-monte mx-auto max-w-xl rounded-pastille bg-aubergine px-4 py-3 text-blanc">
        Un changement fait hors connexion n&apos;a pas pu être enregistré : la liste a changé entre-temps.
      </p>
    </div>
  ) : null;
}
