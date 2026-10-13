"use client";

import { useActionState } from "react";
import { joinFamily } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

export function FamilyCodeForm() {
  const [state, action] = useActionState(joinFamily, {});
  return (
    <form action={action} className="space-y-3">
      <input
        name="code"
        required
        aria-label="Code famille"
        placeholder="ex : quiche-1234-tomate"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-2xl border-2 border-stone-200 bg-white px-5 py-4 text-xl outline-none focus:border-tomato-500"
      />
      {state.error && <p className="rounded-xl bg-tomato-50 px-4 py-3 text-lg text-tomato-700">{state.error}</p>}
      <SubmitButton className="w-full rounded-2xl bg-stone-800 py-4 text-xl font-bold text-white active:scale-[0.98]">
        Rejoindre ma famille
      </SubmitButton>
      <p className="text-center text-sm text-stone-500">À saisir une seule fois sur ce téléphone.</p>
    </form>
  );
}
