"use client";

import { useActionState } from "react";
import { enterFamilyCode } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

export function FamilyCodeForm() {
  const [state, action] = useActionState(enterFamilyCode, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-lg font-semibold">Le code de la famille</span>
        <input
          name="code"
          type="password"
          required
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-2xl border-2 border-stone-200 bg-white px-5 py-4 text-2xl outline-none focus:border-tomato-500"
        />
      </label>
      {state.error && <p className="rounded-xl bg-tomato-50 px-4 py-3 text-lg text-tomato-700">{state.error}</p>}
      <SubmitButton className="w-full rounded-2xl bg-tomato-500 py-4 text-xl font-bold text-white shadow-lg shadow-tomato-500/30 active:scale-[0.98]">
        Entrer
      </SubmitButton>
      <p className="text-center text-sm text-stone-500">À saisir une seule fois sur ce téléphone.</p>
    </form>
  );
}
