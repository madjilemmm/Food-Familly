"use client";

import { useOptimistic, useTransition } from "react";
import { direMerci } from "@/app/actions/trips";
import { IconeCoeur } from "@/components/ui";
import { useErreurReseau } from "@/components/ErreurReseau";

/** « Dire merci » à la personne qui a fait les courses : un appui, un cœur. */
export function Merci({ tripId, dejaDit }: { tripId: string; dejaDit: boolean }) {
  const [, startTransition] = useTransition();
  const [dit, dire] = useOptimistic(dejaDit, () => true);
  const { essayer, alerte } = useErreurReseau();
  return (
    <>
      <button
        type="button"
        disabled={dit}
        aria-pressed={dit}
        onClick={() =>
          startTransition(async () => {
            dire(true);
            await essayer(() => direMerci(tripId));
          })
        }
        className={`kd-btn min-h-12 gap-2 px-5 ${dit ? "kd-btn--like" : "kd-btn--secondaire"}`}
      >
        <IconeCoeur className="size-6" />
        {dit ? "Merci envoyé" : "Dire merci"}
      </button>
      {alerte}
    </>
  );
}
