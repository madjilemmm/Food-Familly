"use client";

import { useActionState } from "react";
import { submitRequest } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { SubmitButton } from "@/components/SubmitButton";
import type { Recipe } from "@/lib/data";

export function RequestForm({
  choices,
  initialText,
  initialRecipeIds,
  alreadySent,
}: {
  choices: Recipe[];
  initialText: string;
  initialRecipeIds: string[];
  alreadySent: boolean;
}) {
  const [state, action] = useActionState(submitRequest, {});

  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-lg font-bold">Tu veux manger quoi ? 😋</span>
        <textarea
          name="free_text"
          defaultValue={initialText}
          rows={3}
          maxLength={500}
          placeholder="Des pâtes carbo, des céréales, du Nutella…"
          className="w-full rounded-2xl border-2 border-fuchsia-100 bg-white px-4 py-3 outline-none focus:border-fuchsia-400"
        />
      </label>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-lg font-bold">Et/ou choisis parmi vos matchs 💞</legend>
        {choices.length === 0 ? (
          <p className="rounded-2xl bg-white/70 px-4 py-3 text-stone-500">Pas encore de match. Swipe avec ton frère !</p>
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
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-4 ring-transparent transition peer-checked:ring-fuchsia-500 peer-focus-visible:ring-fuchsia-300">
                  <RecipeVisual recipe={r} className="aspect-square w-full" emojiClassName="text-5xl" />
                  <p className="px-3 py-2 text-sm leading-tight font-bold">{r.title}</p>
                </div>
                <span className="absolute top-2 right-2 hidden size-8 items-center justify-center rounded-full bg-fuchsia-500 font-bold text-white peer-checked:flex">
                  ✓
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {state.error && <p className="rounded-xl bg-red-100 px-4 py-2 text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-emerald-100 px-4 py-2 font-semibold text-emerald-800">Envoyé à maman ! 📨</p>}

      <SubmitButton
        pendingLabel="Envoi…"
        className="sticky bottom-24 w-full rounded-full bg-gradient-to-r from-fuchsia-600 to-orange-500 py-4 text-xl font-extrabold text-white shadow-xl active:scale-[0.98]"
      >
        {alreadySent ? "Mettre à jour ma demande" : "Envoyer à maman 📨"}
      </SubmitButton>
    </form>
  );
}
