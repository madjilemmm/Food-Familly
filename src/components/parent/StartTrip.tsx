"use client";

import { useState, useTransition } from "react";
import { startTrip } from "@/app/actions/trips";
import type { DepartureChoice } from "@/lib/domain/trip";

export function StartTrip({ choices, kids }: { choices: { id: DepartureChoice; label: string }[]; kids: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<DepartureChoice | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full flex-col items-center gap-3 rounded-[2rem] bg-tomato-500 px-6 py-12 text-white shadow-xl shadow-tomato-500/30 active:scale-[0.98]"
      >
        <span className="text-7xl">🛒</span>
        <span className="text-3xl leading-tight font-extrabold">Je pars faire les courses dans…</span>
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
              startTransition(() => startTrip(c.id));
            }}
            className={`min-h-24 rounded-3xl px-3 text-2xl font-bold active:scale-95 disabled:opacity-60 ${
              chosen === c.id ? "bg-tomato-600 text-white" : "bg-tomato-50 text-tomato-700"
            } ${choices.length % 2 === 1 && c === choices[choices.length - 1] ? "col-span-2" : ""}`}
          >
            {pending && chosen === c.id ? "…" : c.label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-base text-stone-500">{kids} seront prévenus sur leur téléphone.</p>
      <button onClick={() => setOpen(false)} disabled={pending} className="mt-2 w-full py-3 text-lg text-stone-500 underline">
        Annuler
      </button>
    </div>
  );
}
