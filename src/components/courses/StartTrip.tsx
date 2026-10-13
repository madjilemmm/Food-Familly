"use client";

import { useState, useTransition } from "react";
import { startTrip } from "@/app/actions/trips";
import type { DepartureChoice } from "@/lib/domain/trip";
import type { Style } from "@/lib/session";

export function StartTrip({
  choices,
  others,
  variant,
}: {
  choices: { id: DepartureChoice; label: string }[];
  /** Les autres membres, prévenus par notification. */
  others: string[];
  variant: Style;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<DepartureChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fun = variant === "fun";

  const names = others.length > 1 ? `${others.slice(0, -1).join(", ")} et ${others[others.length - 1]}` : others[0];
  const who =
    others.length === 0
      ? "Ajoutez des membres dans « Ma famille » pour qu'ils soient prévenus."
      : others.length > 4
        ? "Toute la famille recevra une notification."
        : `${names} ${others.length > 1 ? "recevront" : "recevra"} une notification.`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex w-full flex-col items-center gap-3 rounded-[2rem] px-6 text-white shadow-xl active:scale-[0.98] ${
          fun
            ? "bg-gradient-to-br from-orange-500 to-fuchsia-500 py-10 shadow-fuchsia-500/30"
            : "bg-tomato-500 py-12 shadow-tomato-500/30"
        }`}
      >
        <span className={fun ? "text-6xl" : "text-7xl"}>🛒</span>
        <span className={`${fun ? "text-2xl" : "text-3xl"} leading-tight font-extrabold`}>Je pars faire les courses dans…</span>
      </button>
    );
  }

  return (
    <div className="rounded-[2rem] bg-white p-5 shadow-xl">
      <p className="mb-4 text-center text-2xl font-bold">Je pars dans…</p>
      <div className="grid grid-cols-2 gap-3">
        {choices.map((c) => (
          <button
            key={c.id}
            disabled={pending}
            onClick={() => {
              setChosen(c.id);
              setError(null);
              startTransition(async () => {
                const res = await startTrip(c.id);
                if (res?.error) setError(res.error);
              });
            }}
            className={`min-h-24 rounded-3xl px-3 text-2xl font-bold active:scale-95 disabled:opacity-60 ${
              chosen === c.id
                ? fun
                  ? "bg-fuchsia-600 text-white"
                  : "bg-tomato-600 text-white"
                : fun
                  ? "bg-fuchsia-50 text-fuchsia-700"
                  : "bg-tomato-50 text-tomato-700"
            } ${choices.length % 2 === 1 && c === choices[choices.length - 1] ? "col-span-2" : ""}`}
          >
            {pending && chosen === c.id ? "…" : c.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-center text-red-800">{error}</p>}
      <p className="mt-4 text-center text-base text-stone-500">{who}</p>
      <button onClick={() => setOpen(false)} disabled={pending} className="mt-2 w-full py-3 text-lg text-stone-500 underline">
        Annuler
      </button>
    </div>
  );
}
