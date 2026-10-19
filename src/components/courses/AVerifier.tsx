"use client";

import { useOptimistic, useTransition } from "react";
import { addItems } from "@/app/actions/list";
import { ajouterSuggestions, refuserSuggestion } from "@/app/actions/trips";
import type { Suggestion } from "@/lib/domain/habitudes";
import { formatQuantity } from "@/lib/domain/shopping-list";
import { IconeCroix, IconePlus } from "@/components/ui";
import { useErreurReseau } from "@/components/ErreurReseau";

const pastille = "flex min-h-11 items-center gap-1.5 rounded-bouton border-[3px] border-trait bg-surface px-3 font-semibold text-encre active:scale-95";

/**
 * « À ajouter ? », avant de partir : ce qui n'a pas été pris la dernière fois, les achats
 * habituels dont c'est le moment, et les ingrédients sans doute déjà à la maison.
 * Rien ne va sur la liste sans un geste : « + » ajoute, « × » dit « pas besoin ».
 */
export function AVerifier({ noms, reportes = [], habituels = [] }: { noms: string[]; reportes?: Suggestion[]; habituels?: Suggestion[] }) {
  const [, startTransition] = useTransition();
  const [masques, masquer] = useOptimistic(new Set<string>(), (state, cles: string[]) => new Set([...state, ...cles]));
  const { essayer, alerte } = useErreurReseau();
  const visibles = (l: Suggestion[]) => l.filter((s) => !masques.has(s.cle));
  const restesR = visibles(reportes);
  const restesH = visibles(habituels);
  const restesM = noms.filter((n) => !masques.has(`maison:${n}`));
  if (restesR.length + restesH.length + restesM.length === 0) return alerte;

  const ajouter = (s: Suggestion[]) =>
    startTransition(async () => {
      masquer(s.map((x) => x.cle));
      await essayer(() => ajouterSuggestions(s));
    });
  const refuser = (s: Suggestion) =>
    startTransition(async () => {
      masquer([s.cle]);
      await essayer(() => refuserSuggestion(s.cle));
    });
  const tous = [...restesR, ...restesH];

  const groupe = (titre: string, liste: Suggestion[]) =>
    liste.length > 0 && (
      <div className="mb-3">
        <p className="kd-petit mb-2">{titre}</p>
        <ul className="flex flex-wrap gap-2">
          {liste.map((s) => (
            <li key={s.cle} className="flex items-stretch">
              <button type="button" aria-label={`Ajouter ${s.nom} à la liste`} onClick={() => ajouter([s])} className={`${pastille} rounded-r-none border-r-0 pr-2`}>
                <IconePlus className="size-4 text-violet" />
                {s.nom}
                {s.quantite != null && <span className="font-normal text-encre-douce">({formatQuantity(s.quantite, s.unite)})</span>}
              </button>
              <button
                type="button"
                aria-label={`Pas besoin de ${s.nom}`}
                onClick={() => refuser(s)}
                className="flex min-h-11 items-center rounded-r-bouton border-[3px] border-l-0 border-trait bg-surface pr-2.5 pl-1 text-encre-douce active:scale-95"
              >
                <IconeCroix className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="kd-etiquette">À ajouter ?</h2>
        {tous.length > 1 && (
          <button type="button" onClick={() => ajouter(tous)} className="min-h-11 font-semibold text-violet underline underline-offset-4">
            Tout ajouter
          </button>
        )}
      </div>
      {groupe("Pas pris la dernière fois", restesR)}
      {groupe("Tes habituels", restesH)}
      {restesM.length > 0 && (
        <div>
          <p className="kd-petit mb-2">Sans doute déjà à la maison. Touche ce qui manque : ça va sur la liste.</p>
          <ul className="flex flex-wrap gap-2">
            {restesM.map((nom) => (
              <li key={nom}>
                <button
                  type="button"
                  aria-label={`Il manque : ${nom}, l'ajouter à la liste`}
                  onClick={() =>
                    startTransition(async () => {
                      masquer([`maison:${nom}`]);
                      await essayer(() => addItems([nom]));
                    })
                  }
                  className={pastille}
                >
                  <IconePlus className="size-4 text-violet" />
                  {nom}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {alerte}
    </section>
  );
}
