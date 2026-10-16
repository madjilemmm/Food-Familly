"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Spinner } from "@/components/Spinner";
import type { DepartureChoice } from "@/lib/domain/trip";

export function StartTrip({
  choices,
  others,
}: {
  choices: { id: DepartureChoice; label: string }[];
  /** Les autres membres, prévenus par notification. */
  others: string[];
}) {
  // Un formulaire HTML classique (POST puis redirection) : l'écran suit à coup sûr,
  // même si les onglets sont encore en train de se précharger.
  const [choisi, setChoisi] = useState<DepartureChoice | null>(null);
  const names = others.length > 1 ? `${others.slice(0, -1).join(", ")} et ${others[others.length - 1]}` : others[0];
  const who =
    others.length === 0
      ? "Ajoute ta famille dans les réglages pour la prévenir."
      : others.length > 4
        ? "Toute la famille reçoit une notif et choisit ses plats."
        : `${names} ${others.length > 1 ? "reçoivent" : "reçoit"} une notif et ${others.length > 1 ? "choisissent leurs" : "choisit ses"} plats.`;

  // Les durées tout de suite : un seul appui pour lancer les courses.
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="kd-carte gap-4 p-5"
    >
      <p className="kd-titre-2 text-center text-aubergine">Je pars faire les courses dans…</p>
      <form method="post" action="/api/courses/depart" className="grid grid-cols-2 gap-3">
        {choices.map((c) => (
          <ChoixDepart
            key={c.id}
            id={c.id}
            label={c.label}
            choisi={choisi}
            onChoisir={setChoisi}
            large={choices.length % 2 === 1 && c === choices[choices.length - 1]}
          />
        ))}
      </form>
      <p className="kd-petit text-center">{who}</p>
    </motion.div>
  );
}

/** Une durée : bouton d'envoi du formulaire ; celle choisie attend la réponse, les autres s'effacent. */
function ChoixDepart({
  id,
  label,
  large,
  choisi,
  onChoisir,
}: {
  id: DepartureChoice;
  label: string;
  large: boolean;
  choisi: DepartureChoice | null;
  onChoisir: (id: DepartureChoice) => void;
}) {
  const envoi = choisi !== null;
  return (
    <button
      type="submit"
      name="choice"
      value={id}
      onClick={(e) => (envoi ? e.preventDefault() : onChoisir(id))}
      aria-busy={choisi === id}
      className={`kd-btn min-h-20 px-3 whitespace-nowrap ${choisi === id ? "" : "kd-btn--secondaire"} ${envoi && choisi !== id ? "opacity-40" : ""} ${
        large ? "col-span-2" : ""
      }`}
    >
      {choisi === id ? <Spinner className="w-8" /> : label}
    </button>
  );
}
