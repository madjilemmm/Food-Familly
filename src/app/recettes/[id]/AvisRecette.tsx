"use client";

import { useOptimistic, useTransition } from "react";
import { oublierAvis, swipe } from "@/app/actions/swipes";
import { useErreurReseau } from "@/components/ErreurReseau";

export type EtatAvis = "envie" | "aime" | "refuse" | null;

const TEXTE: Record<NonNullable<EtatAvis> | "aucun", string> = {
  envie: "Tu en as envie en ce moment.",
  aime: "Tu aimes ce plat, sans envie en ce moment.",
  refuse: "Pas pour toi, pour l'instant.",
  aucun: "Tu ne l'as pas encore swipé.",
};

/**
 * Ton avis sur ce plat, modifiable à tout moment : le même geste que le swipe
 * (« J'en ai envie » / « Pas envie »), sans attendre que la carte revienne.
 */
export function AvisRecette({ recipeId, etat }: { recipeId: string; etat: EtatAvis }) {
  const [, startTransition] = useTransition();
  const [courant, setCourant] = useOptimistic(etat);
  const { essayer, alerte } = useErreurReseau();
  const choisir = (suivant: EtatAvis, action: () => Promise<unknown>) =>
    startTransition(async () => {
      setCourant(suivant);
      await essayer(action);
    });
  const bouton = (actif: boolean) =>
    `kd-btn min-h-12 flex-1 px-3 ${actif ? "" : "kd-btn--secondaire"}`;
  return (
    <section className="mt-6 flex flex-col gap-3">
      <p className="text-encre-douce">{TEXTE[courant ?? "aucun"]}</p>
      <div className="flex gap-3">
        <button type="button" aria-pressed={courant === "envie"} onClick={() => choisir("envie", () => swipe(recipeId, true))} className={bouton(courant === "envie")}>
          J&apos;en ai envie
        </button>
        <button
          type="button"
          aria-pressed={courant === "aime" || courant === "refuse"}
          // « Pas envie » sur un plat aimé : on garde le goût, sans l'envie.
          onClick={() => choisir(courant === "envie" || courant === "aime" ? "aime" : "refuse", () => swipe(recipeId, false))}
          className={bouton(courant === "aime" || courant === "refuse")}
        >
          Pas envie
        </button>
      </div>
      {courant && (
        <button type="button" onClick={() => choisir(null, () => oublierAvis(recipeId))} className="self-start min-h-11 text-encre-douce underline underline-offset-4">
          Effacer mon avis
        </button>
      )}
      {alerte}
    </section>
  );
}
