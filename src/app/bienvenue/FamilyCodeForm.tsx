"use client";

import { useActionState } from "react";
import { joinFamily } from "@/app/actions/auth";
import { sansPlantage } from "@/lib/reseau";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";

export function FamilyCodeForm() {
  const [state, action] = useActionState(sansPlantage(joinFamily), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="code" className="kd-titre-3 text-aubergine">
        Le code de la famille
      </label>
      <input
        id="code"
        name="code"
        required
        aria-label="Code famille"
        placeholder="quiche-1234-tomate"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="kd-champ kd-champ--code text-bouton! tracking-[0.02em]!"
      />
      {state.error && <MessageErreur>{state.error}</MessageErreur>}
      <SubmitButton>C&apos;est parti</SubmitButton>
      <p className="kd-petit text-center">À taper une seule fois sur ce téléphone. Un lien d&apos;invitation marche aussi : colle-le ici.</p>
    </form>
  );
}
