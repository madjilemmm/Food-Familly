"use client";

import { useTransition } from "react";
import { corrigerGout } from "@/app/actions/tastes";
import { useErreurReseau } from "@/components/ErreurReseau";

/** « Pas vraiment » : ce goût déclaré est retiré, le paquet en tient compte tout de suite. */
export function PasVraiment({ food }: { food: string }) {
  const [pending, startTransition] = useTransition();
  const { essayer, alerte } = useErreurReseau();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await essayer(() => corrigerGout(food))))}
        className="min-h-11 shrink-0 px-1 text-encre-douce underline underline-offset-4"
      >
        Pas vraiment
      </button>
      {alerte}
    </>
  );
}
