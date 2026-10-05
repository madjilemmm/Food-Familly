"use client";

import { useOptimistic, useTransition } from "react";
import { setTripRecipe } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import type { CandidateRecipe } from "@/lib/views";

/** Liste de plats à cocher pour les courses : un tap = coché / décoché. */
export function RecipeChecklist({ recipes, disabled = false }: { recipes: CandidateRecipe[]; disabled?: boolean }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    recipes,
    (state, { id, checked }: { id: string; checked: boolean }) =>
      state.map((r) => (r.id === id ? { ...r, checked } : r)),
  );

  return (
    <ul className="space-y-3">
      {optimistic.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            disabled={disabled}
            aria-pressed={r.checked}
            onClick={() =>
              startTransition(async () => {
                setOptimistic({ id: r.id, checked: !r.checked });
                await setTripRecipe(r.id, !r.checked);
              })
            }
            className={`flex w-full items-center gap-4 rounded-3xl border-4 bg-white p-3 text-left transition-colors active:scale-[0.99] ${
              r.checked ? "border-basil-500" : "border-transparent"
            }`}
          >
            <RecipeVisual recipe={r} className="size-20 shrink-0 rounded-2xl" emojiClassName="text-4xl" />
            <span className="min-w-0 flex-1">
              <span className="block text-xl leading-tight font-bold">{r.title}</span>
              <span className="mt-1 flex flex-wrap gap-1.5 text-sm font-semibold">
                {r.wantedBy.map((name) => (
                  <span key={name} className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                    {name} le veut
                  </span>
                ))}
                {r.isMatch && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">❤️ Les deux aiment</span>}
              </span>
            </span>
            <span
              aria-hidden
              className={`flex size-11 shrink-0 items-center justify-center rounded-full text-2xl font-bold ${
                r.checked ? "bg-basil-500 text-white" : "border-4 border-stone-200"
              }`}
            >
              {r.checked ? "✓" : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
