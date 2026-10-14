"use client";

import { useOptimistic, useTransition } from "react";
import { setStrictDislikes } from "@/app/actions/tastes";

/** Mode strict : ce qu'un membre n'aime pas disparaît pour toute la famille. */
export function StrictToggle({ strict }: { strict: boolean }) {
  const [, startTransition] = useTransition();
  const [on, setOn] = useOptimistic(strict);
  return (
    <section className="kd-carte gap-3 p-5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="kd-titre-3 text-aubergine">Mode strict</h2>
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
              await setStrictDislikes(!on);
            })
          }
          className={`relative h-9 w-16 shrink-0 rounded-full border-[3px] border-aubergine transition-colors duration-240 ${on ? "bg-accent" : "bg-surface"}`}
        >
          <span
            aria-hidden
            className={`absolute top-1/2 left-1 size-6 -translate-y-1/2 rounded-full bg-aubergine transition-transform duration-240 ease-rebond ${on ? "translate-x-7" : ""}`}
          />
        </button>
      </div>
      <p className="kd-petit">Les interdits (allergies, régimes) disparaissent toujours pour tout le monde.</p>
    </section>
  );
}
