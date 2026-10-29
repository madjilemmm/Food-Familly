"use client";

import { useActionState, useState } from "react";
import { createFamily } from "@/app/actions/auth";
import { sansPlantage } from "@/lib/reseau";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";

/**
 * Ton prénom et combien vous êtes à table : de quoi calibrer la première liste de courses.
 * Le reste de la famille arrive ensuite avec le lien d'invitation.
 */
export function CreateFamilyForm() {
  const [state, action] = useActionState(sansPlantage(createFamily), {});
  const [foyer, setFoyer] = useState(4);
  return (
    <form action={action} className="flex flex-col gap-6">
      <label className="block">
        <span className="kd-etiquette mb-2 block">Ton prénom</span>
        <input name="prenom" required maxLength={40} autoComplete="given-name" placeholder="ex. Camille" className="kd-champ" />
      </label>
      <fieldset>
        <legend className="kd-etiquette mb-2">Vous êtes combien à table ?</legend>
        <input type="hidden" name="foyer" value={foyer} />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={foyer === n}
              onClick={() => setFoyer(n)}
              className={`min-h-14 flex-1 rounded-bouton border-[3px] border-aubergine text-[1.125rem] font-semibold active:scale-95 ${
                foyer === n ? "bg-aubergine text-blanc" : "bg-blanc text-aubergine"
              }`}
            >
              {n === 5 ? "5+" : n}
            </button>
          ))}
        </div>
      </fieldset>

      {state.error && <MessageErreur>{state.error}</MessageErreur>}

      <SubmitButton pendingLabel="Création…">Voir ce soir</SubmitButton>
    </form>
  );
}
