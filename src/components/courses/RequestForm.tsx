"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitRequest } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import { sansPlantage } from "@/lib/reseau";
import type { Recipe } from "@/lib/data";

type Etat = { ok?: boolean; error?: string; saisi?: { texte: string; plats: string[] } };

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
  // Après un échec (réseau, refus), le formulaire se remet à zéro : on lui redonne ce qui avait été saisi.
  const [state, action] = useActionState(async (prev: Etat, fd: FormData): Promise<Etat> => {
    const saisi = { texte: String(fd.get("free_text") ?? ""), plats: fd.getAll("recipe_ids").map(String) };
    const res = await sansPlantage(submitRequest, "Pas de réseau : ta demande n'est pas encore partie. Ton texte est gardé, réessaie quand ça revient.")(prev, fd);
    return res.ok ? res : { ...res, saisi };
  }, {});
  const plats = state.saisi?.plats ?? initialRecipeIds;

  return (
    <form action={action} className="flex flex-col gap-6">
      <label className="block">
        <span className="kd-etiquette mb-2 block">Écris ce que tu veux</span>
        <textarea
          name="free_text"
          defaultValue={state.saisi?.texte ?? initialText}
          rows={3}
          maxLength={500}
          placeholder="Des pâtes carbo, des céréales, du Nutella…"
          className="kd-champ py-3"
        />
      </label>

      {envies.length === 0 && matchs.length === 0 ? (
        <p className="text-encre-douce">
          Pas encore d&apos;envie. Écris ce que tu veux, ou{" "}
          <Link href="/envies" className="font-semibold text-violet underline underline-offset-4">
            swipe des plats
          </Link>{" "}
          : ils arriveront ici.
        </p>
      ) : (
        <>
          <Plats legende="Tes envies et tes plats aimés" detail="Pour toi" recettes={envies} initialRecipeIds={plats} />
          <Plats legende="Les matchs" detail="Envies en commun" recettes={matchs} initialRecipeIds={plats} />
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
              <RecipeVisual recipe={r} taille="vignette" className="size-14 shrink-0 rounded-pastille" />
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
