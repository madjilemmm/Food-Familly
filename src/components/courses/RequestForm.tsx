"use client";

import { useActionState } from "react";
import { submitRequest } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import type { Recipe } from "@/lib/data";

export function RequestForm({
  choices,
  initialText,
  initialRecipeIds,
  alreadySent,
  shopperName,
}: {
  choices: Recipe[];
  initialText: string;
  initialRecipeIds: string[];
  alreadySent: boolean;
  shopperName: string;
}) {
  const [state, action] = useActionState(submitRequest, {});

  return (
    <form action={action} className="flex flex-col gap-6">
      <label className="block">
        <span className="kd-etiquette mb-2 block">Écris ce que tu veux</span>
        <textarea
          name="free_text"
          defaultValue={initialText}
          rows={3}
          maxLength={500}
          placeholder="Des pâtes carbo, des céréales, du Nutella…"
          className="kd-champ py-3"
        />
      </label>

      <fieldset className="min-w-0">
        <legend className="kd-etiquette mb-2">Ou choisis parmi les matchs</legend>
        {choices.length === 0 ? (
          <p className="text-encre-douce">Pas encore de match. Swipe avec ta famille pour en trouver.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {choices.map((r) => (
              <label key={r.id} className="group relative cursor-pointer">
                <input
                  type="checkbox"
                  name="recipe_ids"
                  value={r.id}
                  defaultChecked={initialRecipeIds.includes(r.id)}
                  className="peer sr-only"
                />
                <div className="kd-carte outline-4 -outline-offset-4 outline-transparent transition duration-150 group-active:scale-95 peer-checked:outline-accent peer-focus-visible:outline-focus">
                  <RecipeVisual recipe={r} className="aspect-[4/3] w-full" />
                  <p className="p-3 text-petit leading-tight font-semibold">{r.title}</p>
                </div>
                <span className="absolute top-2 right-2 hidden size-9 items-center justify-center rounded-pastille bg-accent text-on-accent peer-checked:flex">
                  <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5L19.5 7" />
                  </svg>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {state.error && <MessageErreur>{state.error}</MessageErreur>}
      {state.ok && (
        <p role="status" className="kd-pastille kd-pastille--match self-start text-petit!">
          Envoyé à {shopperName}
        </p>
      )}

      <SubmitButton pendingLabel="Envoi…">
        {alreadySent ? "Mettre à jour ma demande" : `Envoyer à ${shopperName}`}
      </SubmitButton>
    </form>
  );
}
