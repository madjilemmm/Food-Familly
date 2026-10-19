"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { marquerRepas } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { useErreurReseau } from "@/components/ErreurReseau";
import { listeDeNoms } from "@/lib/domain/convives";
import type { RepasAchete } from "@/lib/data";

/**
 * « Ce soir, on mange quoi ? » : les plats achetés à la dernière course, pas encore cuisinés.
 * Un appui ouvre la recette en mode cuisine ; « Fait » le range.
 */
export function CeSoir({ tripId, plats, moi }: { tripId: string; plats: RepasAchete[]; moi: string }) {
  const [, startTransition] = useTransition();
  const [liste, appliquer] = useOptimistic(plats, (state, c: { id: string; fait: boolean }) =>
    state.map((p) => (p.id === c.id ? { ...p, fait: c.fait } : p)),
  );
  const { essayer, alerte } = useErreurReseau();
  const marquer = (id: string, fait: boolean) =>
    startTransition(async () => {
      appliquer({ id, fait });
      await essayer(() => marquerRepas(tripId, id, fait));
    });
  const aFaire = liste.filter((p) => !p.fait);
  const faits = liste.filter((p) => p.fait);
  if (aFaire.length === 0 && faits.length === 0) return null;

  const ligne = (p: RepasAchete) => (
    <li key={p.id} className="flex items-center gap-3 border-b-2 border-trait py-2">
      <Link href={`/recettes/${p.id}?depuis=/courses&cuisine=1`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 active:opacity-80">
        <RecipeVisual recipe={p} taille="vignette" className="size-14 shrink-0 rounded-pastille" />
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${p.fait ? "text-encre-douce line-through" : ""}`}>{p.title}</span>
          <span className="kd-petit block">
            {[p.mangeurs.length ? `Pour ${listeDeNoms(p.mangeurs, moi).replace(/^Toi\b/, "toi")}` : null, p.total_minutes ? `${p.total_minutes} min` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </Link>
      <button
        type="button"
        aria-pressed={p.fait}
        aria-label={p.fait ? `${p.title} : pas encore fait` : `${p.title} : c'est fait`}
        onClick={() => marquer(p.id, !p.fait)}
        className={`min-h-11 shrink-0 rounded-bouton border-[3px] px-3 font-semibold active:scale-95 ${
          p.fait ? "border-aubergine bg-accent text-on-accent" : "border-trait text-encre-douce"
        }`}
      >
        {p.fait ? "Fait" : "C'est fait"}
      </button>
    </li>
  );

  return (
    <section className="mb-10">
      <h2 className="kd-etiquette">Ce soir, on mange quoi ?</h2>
      <p className="kd-petit mb-2">
        {aFaire.length > 0 ? "Aux dernières courses, vous avez acheté pour :" : "Tout ce qui a été acheté est cuisiné. Bravo !"}
      </p>
      {aFaire.length > 0 && <ul className="kd-liste border-t-2 border-trait">{aFaire.map(ligne)}</ul>}
      {faits.length > 0 && (
        <details className="mt-2">
          <summary className="flex min-h-12 cursor-pointer list-none items-center font-semibold text-violet">Déjà cuisinés ({faits.length})</summary>
          <ul className="kd-liste">{faits.map(ligne)}</ul>
        </details>
      )}
      {alerte}
    </section>
  );
}
