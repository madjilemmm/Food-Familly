"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { setTripRecipe } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import type { CandidateRecipe } from "@/lib/views";

/**
 * Les plats proposés pour les courses, en simple liste à cocher (comme la liste
 * de courses) : un appui sur la ligne garde ou retire le plat ; la photo ouvre la recette.
 */
export function RecipeChecklist({ recipes, disabled = false }: { recipes: CandidateRecipe[]; disabled?: boolean }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    recipes,
    (state, { id, checked }: { id: string; checked: boolean }) =>
      state.map((r) => (r.id === id ? { ...r, checked } : r)),
  );
  const set = (id: string, checked: boolean) =>
    startTransition(async () => {
      setOptimistic({ id, checked });
      await setTripRecipe(id, checked);
    });

  return (
    <ul className="kd-liste">
      {optimistic.map((r) => {
        const pourquoi = [...r.wantedBy.map((n) => `${n} le veut`), r.isMatch && "match"].filter(Boolean).join(" · ");
        return (
          <li key={r.id} className="flex items-center gap-3 border-b-2 border-trait py-2">
            <Link href={`/recettes/${r.id}`} aria-label={`La recette : ${r.title}`} className="shrink-0 active:scale-95">
              <RecipeVisual recipe={r} className="size-14 rounded-pastille" />
            </Link>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={r.checked}
              aria-label={`Garder ${r.title}`}
              onClick={() => set(r.id, !r.checked)}
              className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.title}</span>
                {pourquoi && <span className="kd-petit block">{pourquoi}</span>}
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
          </li>
        );
      })}
    </ul>
  );
}
