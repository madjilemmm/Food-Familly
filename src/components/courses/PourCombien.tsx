"use client";

import { useOptimistic, useTransition } from "react";
import { setTripPeople } from "@/app/actions/trips";
import { IconePlus } from "@/components/ui";

/** « Pour combien ? » : la liste ajuste les quantités des recettes à ce nombre. */
export function PourCombien({ people }: { people: number }) {
  const [, startTransition] = useTransition();
  const [n, setN] = useOptimistic(people);
  const changer = (delta: number) => {
    const next = Math.min(30, Math.max(1, n + delta));
    if (next === n) return;
    startTransition(async () => {
      setN(next);
      await setTripPeople(next);
    });
  };
  return (
    <section className="kd-carte mb-6 flex-row items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="kd-titre-3 text-aubergine">Pour {n} personne{n > 1 ? "s" : ""}</p>
        <p className="kd-petit">Les quantités des recettes s&apos;ajustent.</p>
      </div>
      <button type="button" aria-label="Une personne de moins" onClick={() => changer(-1)} disabled={n <= 1} className="kd-btn kd-btn--secondaire w-14 px-0 text-titre-2">
        −
      </button>
      <span aria-live="polite" className="w-8 text-center font-display text-titre-2 text-aubergine">
        {n}
      </span>
      <button type="button" aria-label="Une personne de plus" onClick={() => changer(1)} disabled={n >= 30} className="kd-btn kd-btn--secondaire w-14 px-0">
        <IconePlus />
      </button>
    </section>
  );
}
