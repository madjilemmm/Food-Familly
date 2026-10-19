"use client";

import { useOptimistic, useTransition } from "react";
import { setStrictDislikes } from "@/app/actions/tastes";
import { useErreurReseau } from "@/components/ErreurReseau";

/** Mode strict : ce qu'un membre n'aime pas disparaît pour toute la famille. */
export function StrictToggle({ strict }: { strict: boolean }) {
  const [, startTransition] = useTransition();
  const [on, setOn] = useOptimistic(strict);
  const { essayer, alerte } = useErreurReseau();
  return (
    <section className="flex flex-col gap-2 border-y-2 border-trait py-4">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Mode strict</h2>
          <p className="kd-petit mt-1">
            {on
              ? "Ce qu'un membre n'aime pas disparaît du swipe de toute la famille."
              : "Ce qu'un membre n'aime pas reste, en fin de paquet, avec une pastille."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Mode strict"
          onClick={() =>
            startTransition(async () => {
              setOn(!on);
              await essayer(() => setStrictDislikes(!on));
            })
          }
          className="flex h-14 w-20 shrink-0 items-center justify-center rounded-full"
        >
          {/* Le rail fait 36 px de haut, mais toute la zone de 56 px se touche. */}
          <span
            aria-hidden
            className={`relative h-9 w-16 rounded-full border-[3px] border-aubergine transition-colors duration-240 ${on ? "bg-accent" : "bg-surface"}`}
          >
            <span
              className={`absolute top-1/2 left-1 size-6 -translate-y-1/2 rounded-full bg-aubergine transition-transform duration-240 ease-rebond ${on ? "translate-x-7" : ""}`}
            />
          </span>
        </button>
      </div>
      <p className="kd-petit">Les interdits (allergies, régimes) disparaissent toujours pour tout le monde.</p>
      {alerte}
    </section>
  );
}
