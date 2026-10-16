"use client";

import { useOptimistic, useTransition } from "react";
import { setTripPeople } from "@/app/actions/trips";
import { IconePlus } from "@/components/ui";

/** « Pour combien ? » : une ligne, pas une carte. La liste ajuste les quantités des recettes à ce nombre. */
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
  const rond = "flex size-12 items-center justify-center rounded-full border-[3px] border-aubergine text-aubergine active:scale-95 disabled:opacity-30";
  return (
    <div className="mb-6 flex items-center gap-3">
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Pour {n} personne{n > 1 ? "s" : ""}</span>
        <span className="kd-petit block">Les quantités s&apos;ajustent.</span>
      </p>
      <button type="button" aria-label="Une personne de moins" onClick={() => changer(-1)} disabled={n <= 1} className={rond}>
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" aria-label="Une personne de plus" onClick={() => changer(1)} disabled={n >= 30} className={rond}>
        <IconePlus className="size-6" />
      </button>
    </div>
  );
}
