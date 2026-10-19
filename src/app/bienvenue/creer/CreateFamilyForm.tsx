"use client";

import { useActionState } from "react";
import { createFamily } from "@/app/actions/auth";
import { sansPlantage } from "@/lib/reseau";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";

/** Ton prénom, et c'est parti. Le reste de la famille arrive avec le lien d'invitation. */
export function CreateFamilyForm() {
  const [state, action] = useActionState(sansPlantage(createFamily), {});
  return (
    <form action={action} className="flex flex-col gap-6">
      <label className="block">
        <span className="kd-etiquette mb-2 block">Ton prénom</span>
        <input name="prenom" required maxLength={40} autoComplete="given-name" placeholder="Karin" className="kd-champ" />
      </label>
      <label className="block">
        <span className="kd-etiquette mb-2 block">Nom de la famille (facultatif)</span>
        <input name="family_name" maxLength={60} placeholder="Famille Martin" className="kd-champ" />
      </label>

      {state.error && <MessageErreur>{state.error}</MessageErreur>}

      <SubmitButton pendingLabel="Création…">C&apos;est parti</SubmitButton>
      <p className="kd-petit text-center">Ensuite, un lien suffit pour inviter les autres.</p>
    </form>
  );
}
