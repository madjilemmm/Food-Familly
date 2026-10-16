"use client";

import { useActionState } from "react";
import { submitRequest } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import type { Recipe } from "@/lib/data";

export function RequestForm({
  envies,
  matchs,
  initialText,
  initialRecipeIds,
  alreadySent,
  shopperName,
}: {
  /** Mes likes : des plats pour moi. */
  envies: Recipe[];
  /** Les matchs : des plats pour toute la famille. */
  matchs: Recipe[];
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

      {envies.length === 0 && matchs.length === 0 ? (
        <p className="text-encre-douce">Pas encore d&apos;envie ni de match. Swipe pour en trouver.</p>
      ) : (
        <>
          <Plats legende="Tes envies et tes plats aimés" detail="Pour toi" recettes={envies} initialRecipeIds={initialRecipeIds} />
          <Plats legende="Les matchs" detail="Envies en commun" recettes={matchs} initialRecipeIds={initialRecipeIds} />
        </>
      )}

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

/** Des plats à cocher, en liste comme les recettes : vignette, nom, case à droite. */
function Plats({ legende, detail, recettes, initialRecipeIds }: { legende: string; detail: string; recettes: Recipe[]; initialRecipeIds: string[] }) {
  if (recettes.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="kd-etiquette mb-2">
        {legende} <span className="normal-case text-encre-douce">· {detail}</span>
      </legend>
      <ul className="kd-liste border-t-2 border-trait">
        {recettes.map((r) => (
          <li key={r.id}>
            <label className="group flex cursor-pointer items-center gap-4 border-b-2 border-trait py-2 active:bg-trait/40">
              <RecipeVisual recipe={r} className="size-14 shrink-0 rounded-pastille" />
              <span className="min-w-0 flex-1 font-semibold">{r.title}</span>
              <input type="checkbox" name="recipe_ids" value={r.id} defaultChecked={initialRecipeIds.includes(r.id)} className="sr-only" />
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-content-center rounded-pastille border-[3px] border-aubergine bg-surface transition-[background-color,transform] duration-200 ease-rebond group-has-[:checked]:scale-108 group-has-[:checked]:bg-accent group-has-[:checked]:text-on-accent group-has-[:focus-visible]:outline-3 group-has-[:focus-visible]:outline-focus"
              >
                <svg viewBox="0 0 24 24" className="hidden size-5 group-has-[:checked]:block" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5L19.5 7" />
                </svg>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
