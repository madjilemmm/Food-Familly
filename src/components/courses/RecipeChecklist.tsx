"use client";

import { useOptimistic, useTransition } from "react";
import { setTripRecipe } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import type { CandidateRecipe } from "@/lib/views";

/** Les plats proposés pour les courses : « Valider » ou « Pas cette fois ». */
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
    <ul className="flex flex-col gap-4">
      {optimistic.map((r) => (
        <li
          key={r.id}
          className={`kd-carte outline-4 -outline-offset-4 transition-[outline-color] duration-150 ${r.checked ? "outline-accent" : "outline-transparent"}`}
        >
          <div className="flex gap-4 p-4 pb-0">
            <RecipeVisual recipe={r} className="size-20 shrink-0 rounded-pastille" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="font-display text-titre-3 text-aubergine">{r.title}</p>
              <p className="flex flex-wrap gap-1.5">
                {r.wantedBy.map((name) => (
                  <span key={name} className="kd-pastille">
                    {name} le veut
                  </span>
                ))}
                {r.isMatch && <span className="kd-pastille kd-pastille--match">Match</span>}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={r.checked}
              aria-label={`Valider ${r.title}`}
              onClick={() => set(r.id, !r.checked)}
              className={`kd-btn ${r.checked ? "kd-btn--like" : "kd-btn--secondaire"}`}
            >
              {r.checked ? "Validé" : "Valider"}
            </button>
            <button
              type="button"
              disabled={disabled || !r.checked}
              onClick={() => set(r.id, false)}
              className="kd-btn kd-btn--secondaire"
            >
              Pas cette fois
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
