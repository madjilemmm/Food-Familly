"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "motion/react";
import { startTripForm } from "@/app/actions/trips";
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
  // Un vrai formulaire (comme « Faire ma liste ») : envoi et redirection gérés par Next,
  // l'écran suit même si les onglets sont encore en train de se précharger.
  const [state, action] = useActionState(startTripForm, {});
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
      <form action={action} className="grid grid-cols-2 gap-3">
        {choices.map((c) => (
          <ChoixDepart key={c.id} id={c.id} label={c.label} large={choices.length % 2 === 1 && c === choices[choices.length - 1]} />
        ))}
      </form>
      {state.error && <MessageErreur>{state.error}</MessageErreur>}
      <p className="kd-petit text-center">{who}</p>
      <button onClick={() => setOpen(false)} className="min-h-14 w-full text-encre-douce underline underline-offset-4">
        Annuler
      </button>
    </motion.div>
  );
}

/** Une durée : bouton d'envoi du formulaire ; celle choisie attend la réponse, les autres s'effacent. */
function ChoixDepart({ id, label, large }: { id: DepartureChoice; label: string; large: boolean }) {
  const { pending, data } = useFormStatus();
  const choisi = data?.get("choice") === id;
  return (
    <button
      type="submit"
      name="choice"
      value={id}
      disabled={pending}
      className={`kd-btn min-h-20 px-3 whitespace-nowrap ${choisi ? "" : "kd-btn--secondaire"} ${pending && !choisi ? "opacity-40" : ""} ${
        large ? "col-span-2" : ""
      }`}
    >
      {pending && choisi ? <Spinner className="w-8" /> : label}
    </button>
  );
}
