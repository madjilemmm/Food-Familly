"use client";

import { useOptimistic, useTransition } from "react";
import { addItems } from "@/app/actions/list";
import { IconePlus } from "@/components/ui";
import { useErreurReseau } from "@/components/ErreurReseau";

/**
 * « À vérifier avant de partir » : les ingrédients que la famille a sans doute déjà
 * (sel, huile…). Un coup d'œil au placard ; ce qui manque, on le touche et il va sur la liste.
 */
export function AVerifier({ noms }: { noms: string[] }) {
  const [, startTransition] = useTransition();
  const [restants, retirer] = useOptimistic(noms, (state, nom: string) => state.filter((n) => n !== nom));
  const { essayer, alerte } = useErreurReseau();
  if (restants.length === 0) return alerte;
  return (
    <section className="mb-8">
      <h2 className="kd-etiquette">À vérifier avant de partir</h2>
      <p className="kd-petit mb-3">Sans doute déjà à la maison. Touche ce qui manque : ça va sur la liste.</p>
      <ul className="flex flex-wrap gap-2">
        {restants.map((nom) => (
          <li key={nom}>
            <button
              type="button"
              aria-label={`Il manque : ${nom}, l'ajouter à la liste`}
              onClick={() =>
                startTransition(async () => {
                  retirer(nom);
                  await essayer(() => addItems([nom]));
                })
              }
              className="flex min-h-11 items-center gap-1.5 rounded-bouton border-[3px] border-trait bg-surface px-3 font-semibold text-encre active:scale-95"
            >
              <IconePlus className="size-4 text-violet" />
              {nom}
            </button>
          </li>
        ))}
      </ul>
      {alerte}
    </section>
  );
}
