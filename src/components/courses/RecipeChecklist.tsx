"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { setTripRecipe, setTripRecipePeople } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { IconePlus } from "@/components/ui";
import { libelleConvives } from "@/lib/domain/convives";
import type { CandidateRecipe } from "@/lib/views";

type Changement = { id: string; checked?: boolean; n?: number };

/**
 * Les plats proposés pour les courses, en liste à cocher : un appui sur la ligne
 * garde ou retire le plat ; la photo ouvre la recette. Chaque plat dit pour qui il est
 * (déduit des demandes et des matchs) ; −/+ corrige le nombre, et la liste suit.
 */
export function RecipeChecklist({ recipes, moi }: { recipes: CandidateRecipe[]; moi: string }) {
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(recipes, (state, c: Changement) =>
    state.map((r) =>
      r.id === c.id
        ? { ...r, checked: c.checked ?? r.checked, convives: c.n ? { ...r.convives, n: c.n, corrige: true } : r.convives }
        : r,
    ),
  );
  const garder = (id: string, checked: boolean) =>
    startTransition(async () => {
      apply({ id, checked });
      await setTripRecipe(id, checked);
    });
  const pourCombien = (id: string, n: number) =>
    startTransition(async () => {
      apply({ id, n });
      await setTripRecipePeople(id, n);
    });
  const rond =
    "flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-aubergine text-aubergine active:scale-95 disabled:opacity-30";

  return (
    <ul className="kd-liste">
      {optimistic.map((r) => {
        const pourQui = libelleConvives(r.convives, moi);
        const detail = [pourQui, r.isMatch && "match", r.envieDuShopper && !r.isMatch && r.wantedBy.length === 0 && "ton envie"]
          .filter(Boolean)
          .join(" · ");
        const n = r.convives.n;
        return (
          <li key={r.id} className="border-b-2 border-trait py-2">
            <div className="flex items-center gap-3">
              <Link href={`/recettes/${r.id}`} aria-label={`La recette : ${r.title}`} className="shrink-0 active:scale-95">
                <RecipeVisual recipe={r} className="size-14 rounded-pastille" />
              </Link>
              <button
                type="button"
                aria-pressed={r.checked}
                aria-label={`Garder ${r.title}`}
                onClick={() => garder(r.id, !r.checked)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.title}</span>
                  <span className="kd-petit block">{detail}</span>
                </span>
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-content-center rounded-pastille border-[3px] border-aubergine transition-[background-color,transform] duration-200 ease-rebond ${
                    r.checked ? "scale-108 bg-accent text-on-accent" : "bg-surface"
                  }`}
                >
                  {r.checked && (
                    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5L19.5 7" />
                    </svg>
                  )}
                </span>
              </button>
            </div>
            {/* Plat gardé : pour combien (les quantités de la liste suivent). */}
            {r.checked && (
              <div className="mt-1 flex items-center gap-3 pl-[4.25rem]">
                <span className="flex-1 font-semibold">
                  Pour {n} personne{n > 1 ? "s" : ""}
                </span>
                <button type="button" aria-label={`Une personne de moins pour ${r.title}`} onClick={() => pourCombien(r.id, n - 1)} disabled={n <= 1} className={rond}>
                  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                    <path d="M5 12h14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
                  </svg>
                </button>
                <button type="button" aria-label={`Une personne de plus pour ${r.title}`} onClick={() => pourCombien(r.id, n + 1)} disabled={n >= 30} className={rond}>
                  <IconePlus className="size-5" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
