"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { startTrip } from "@/app/actions/trips";
import { Spinner } from "@/components/Spinner";
import { MessageErreur } from "@/components/ui";
import { Bouton } from "@/design-system/components/Kaddie";
import type { DepartureChoice } from "@/lib/domain/trip";

export function StartTrip({
  choices,
  others,
}: {
  choices: { id: DepartureChoice; label: string }[];
  /** Les autres membres, prévenus par notification. */
  others: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<DepartureChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = others.length > 1 ? `${others.slice(0, -1).join(", ")} et ${others[others.length - 1]}` : others[0];
  const who =
    others.length === 0
      ? "Ajoute ta famille dans les réglages pour la prévenir."
      : others.length > 4
        ? "Toute la famille reçoit une notif et choisit ses plats."
        : `${names} ${others.length > 1 ? "reçoivent" : "reçoit"} une notif et ${others.length > 1 ? "choisissent leurs" : "choisit ses"} plats.`;

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <Bouton variante="geant" className="kd-pop" onClick={() => setOpen(true)}>
          Je pars faire les courses
        </Bouton>
        <p className="text-center font-medium">{who}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="kd-carte gap-4 p-5"
    >
      <p className="kd-titre-2 text-center text-aubergine">Je pars dans…</p>
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
            className={`kd-btn min-h-20 px-3 whitespace-nowrap ${chosen === c.id ? "" : "kd-btn--secondaire"} ${
              pending && chosen !== c.id ? "opacity-40" : ""
            } ${choices.length % 2 === 1 && c === choices[choices.length - 1] ? "col-span-2" : ""}`}
          >
            {pending && chosen === c.id ? <Spinner className="w-8" /> : c.label}
          </button>
        ))}
      </div>
      {error && <MessageErreur>{error}</MessageErreur>}
      <p className="kd-petit text-center">{who}</p>
      <button onClick={() => setOpen(false)} disabled={pending} className="min-h-14 w-full text-encre-douce underline underline-offset-4">
        Annuler
      </button>
    </motion.div>
  );
}
